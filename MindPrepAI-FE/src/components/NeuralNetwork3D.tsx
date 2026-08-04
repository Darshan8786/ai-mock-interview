import { useRef, useEffect } from 'react';

export function NeuralNetwork3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        import('three').then((THREE) => {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                75,
                canvas.clientWidth / canvas.clientHeight,
                0.1,
                1000
            );
            const renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: true,
            });

            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            renderer.setClearColor(0x000000, 0);
            camera.position.z = 4;

            // Create neural network nodes
            const nodes: any[] = [];
            const nodeCount = 25;
            const colors = [0x7c3aed, 0x06b6d4, 0xf59e0b, 0x10b981, 0x3b82f6];

            for (let i = 0; i < nodeCount; i++) {
                const geometry = new THREE.SphereGeometry(0.15, 32, 32);
                const colorIndex = i % colors.length;
                const material = new THREE.MeshPhongMaterial({
                    color: colors[colorIndex],
                    emissive: colors[colorIndex],
                    emissiveIntensity: 0.5,
                });
                const node = new THREE.Mesh(geometry, material);

                const angle = (i / nodeCount) * Math.PI * 2;
                const radius = 2 + (i % 3) * 0.5;

                node.position.x = Math.cos(angle) * radius;
                node.position.y = Math.sin(angle) * radius;
                node.position.z = (Math.random() - 0.5) * 2;

                nodes.push({
                    mesh: node,
                    initialPos: node.position.clone(),
                    angle,
                    speed: 0.003 + Math.random() * 0.002,
                });

                scene.add(node);
            }

            // Create connections between nodes
            const connections: any[] = [];
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x7c3aed,
                transparent: true,
                opacity: 0.3,
            });

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    if (Math.random() > 0.85) {
                        const geometry = new THREE.BufferGeometry();
                        const positions = new Float32Array([
                            nodes[i].mesh.position.x,
                            nodes[i].mesh.position.y,
                            nodes[i].mesh.position.z,
                            nodes[j].mesh.position.x,
                            nodes[j].mesh.position.y,
                            nodes[j].mesh.position.z,
                        ]);
                        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                        const line = new THREE.Line(geometry, lineMaterial);
                        connections.push({ line, i, j });
                        scene.add(line);
                    }
                }
            }

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);

            const pointLight1 = new THREE.PointLight(0x7c3aed, 0.8);
            pointLight1.position.set(5, 5, 5);
            scene.add(pointLight1);

            const pointLight2 = new THREE.PointLight(0x06b6d4, 0.6);
            pointLight2.position.set(-5, -5, 5);
            scene.add(pointLight2);

            let animationId: number;
            const animate = () => {
                animationId = requestAnimationFrame(animate);

                nodes.forEach((node, i) => {
                    node.angle += node.speed;
                    const radius = 2 + (i % 3) * 0.5;
                    node.mesh.position.x = Math.cos(node.angle) * radius;
                    node.mesh.position.y = Math.sin(node.angle) * radius;
                    node.mesh.position.z = Math.sin(node.angle * 0.5) * 1.5;

                    node.mesh.scale.x = 1 + Math.sin(Date.now() * 0.001 + i) * 0.3;
                    node.mesh.scale.y = 1 + Math.sin(Date.now() * 0.001 + i) * 0.3;
                    node.mesh.scale.z = 1 + Math.sin(Date.now() * 0.001 + i) * 0.3;
                });

                // Update connections
                connections.forEach((conn) => {
                    const positions = new Float32Array([
                        nodes[conn.i].mesh.position.x,
                        nodes[conn.i].mesh.position.y,
                        nodes[conn.i].mesh.position.z,
                        nodes[conn.j].mesh.position.x,
                        nodes[conn.j].mesh.position.y,
                        nodes[conn.j].mesh.position.z,
                    ]);
                    conn.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                });

                renderer.render(scene, camera);
            };

            animate();

            const handleResize = () => {
                const width = canvas.clientWidth;
                const height = canvas.clientHeight;
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                cancelAnimationFrame(animationId);
            };
        });
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
        />
    );
}
