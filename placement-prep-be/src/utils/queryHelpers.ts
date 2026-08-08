/**
 * Builds a Mongoose query filter from allowed query params, supporting
 * comma-separated multi-values (=> $in) and plain equality.
 */
export const buildFilter = (
  query: Record<string, any>,
  fields: string[]
): Record<string, any> => {
  const filter: Record<string, any> = {};
  fields.forEach((field) => {
    const value = query[field];
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "string" && value.includes(",")) {
      filter[field] = { $in: value.split(",").map((v) => v.trim()) };
    } else {
      filter[field] = value;
    }
  });
  return filter;
};

/**
 * Parses page/limit/sort from query with safe defaults.
 */
export const parsePagination = (query: Record<string, any>) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const sortRaw = query.sort && query.sort !== "" ? query.sort : "-createdAt";
  const sort: Record<string, 1 | -1> = {};
  sortRaw.split(",").forEach((field: string) => {
    if (field.startsWith("-")) sort[field.slice(1)] = -1;
    else sort[field] = 1;
  });
  return { page, limit, sort, skip: (page - 1) * limit };
};

/**
 * Builds a regex $or search across the given fields (case-insensitive).
 */
export const buildSearch = (query: Record<string, any>, fields: string[]) => {
  const search = query.search && query.search.trim();
  if (!search) return null;
  const regex = { $regex: search, $options: "i" };
  return { $or: fields.map((f) => ({ [f]: regex })) };
};
