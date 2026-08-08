import type { PopulateOptions, Query } from "mongoose";
import type { PaginationMeta, QueryOptions } from "../types";

interface ApiFeatureResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Chains pagination, search, filtering and sorting on a Mongoose query.
 *
 * Usage:
 *   const result = await buildQuery(User.find(), {
 *     page: 1, limit: 10, search: "john", sort: "-createdAt"
 *   }, { searchFields: ["name", "email"], filters: { role: "user" } });
 */
export async function executePaginated<T>(
  query: Query<T[], T>,
  options: QueryOptions = {},
  config: {
    searchFields?: string[];
    filters?: Record<string, unknown>;
    populate?: PopulateOptions[];
  } = {}
): Promise<ApiFeatureResult<T>> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 10));
  const skip = (page - 1) * limit;

  // Build the base filter
  const filter: Record<string, unknown> = { ...(config.filters || {}) };

  // Search across specified text fields (OR)
  const search = options.search?.trim();
  if (search && config.searchFields?.length) {
    const regex = { $regex: search, $options: "i" };
    filter.$or = config.searchFields.map((field) => ({ [field]: regex }));
  }

  // Execute count + data in parallel
  const model = query.model;
  const [total, data] = await Promise.all([
    model.countDocuments(filter),
    (() => {
      let q = model.find(filter) as unknown as Query<T[], T>;
      q = q.skip(skip).limit(limit);
      if (options.sort) {
        const sortFields: Record<string, 1 | -1> = {};
        options.sort
          .split(",")
          .filter(Boolean)
          .forEach((field) => {
            if (field.startsWith("-")) {
              sortFields[field.slice(1)] = -1;
            } else {
              sortFields[field] = 1;
            }
          });
        q = q.sort(sortFields);
      } else {
        q = q.sort({ createdAt: -1 });
      }
      if (config.populate?.length) {
        config.populate.forEach((p) => {
          q = q.populate(p) as unknown as Query<T[], T>;
        });
      }
      return q;
    })(),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export function buildMongooseFilter(
  allowedFields: string[],
  query: Record<string, unknown>
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  allowedFields.forEach((field) => {
    const value = query[field];
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "string") {
        // Support comma-separated multi-values -> $in
        if (value.includes(",")) {
          filter[field] = { $in: value.split(",").map((v) => v.trim()) };
        } else {
          filter[field] = value;
        }
      } else {
        filter[field] = value;
      }
    }
  });
  return filter;
}
