import { useRef, useEffect } from 'react';

export function RotatingBooks3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Import Three.js
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
            camera.position.z = 5;

            // Create books (cubes)
            const books: any[] = [];
            const colors = [0x7c3aed, 0x06b6d4, 0xf59e0b, 0x10b981, 0x3b82f6, 0xef4444];

            for (let i = 0; i < 6; i++) {
                const geometry = new THREE.BoxGeometry(0.8, 1.2, 0.3);
                const material = new THREE.MeshPhongMaterial({
                    color: colors[i],
                    emissive: colors[i],
                    emissiveIntensity: 0.3,
                });
                const book = new THREE.Mesh(geometry, material);

                const angle = (i / 6) * Math.PI * 2;
                book.position.x = Math.cos(angle) * 3;
                book.position.y = Math.sin(angle) * 2;
                book.position.z = Math.cos(angle * 2) * 2;

                books.push({
                    mesh: book,
                    angle,
                    speed: 0.005 + i * 0.001,
                });

                scene.add(book);
            }

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0xffffff, 0.8);
            pointLight.position.set(5, 5, 5);
            scene.add(pointLight);

            // Animation loop
            let animationId: number;
            const animate = () => {
                animationId = requestAnimationFrame(animate);

                books.forEach((book) => {
                    book.angle += book.speed;
                    book.mesh.position.x = Math.cos(book.angle) * 3;
                    book.mesh.position.y = Math.sin(book.angle) * 2;
                    book.mesh.position.z = Math.cos(book.angle * 2) * 2;

                    book.mesh.rotation.x += 0.003;
                    book.mesh.rotation.y += 0.005;
                    book.mesh.rotation.z += 0.002;
                });

                renderer.render(scene, camera);
            };

            animate();

            // Handle resize
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
