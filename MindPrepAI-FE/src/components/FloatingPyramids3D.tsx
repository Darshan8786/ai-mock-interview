import { useRef, useEffect } from 'react';

export function FloatingPyramids3D() {
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
            camera.position.z = 6;

            const pyramids: any[] = [];
            const colors = [0x7c3aed, 0x06b6d4, 0xf59e0b, 0x10b981, 0xef4444];

            // Create pyramids
            for (let i = 0; i < 5; i++) {
                const geometry = new THREE.TetrahedronGeometry(0.8, 0);
                const material = new THREE.MeshPhongMaterial({
                    color: colors[i],
                    emissive: colors[i],
                    emissiveIntensity: 0.4,
                    wireframe: false,
                });
                const pyramid = new THREE.Mesh(geometry, material);

                pyramid.position.x = (i - 2) * 2.5;
                pyramid.position.y = Math.sin(i) * 1.5;
                pyramid.position.z = Math.cos(i * 0.5) * 1.5;

                pyramids.push({
                    mesh: pyramid,
                    initialX: pyramid.position.x,
                    initialY: pyramid.position.y,
                    initialZ: pyramid.position.z,
                    time: i * 0.5,
                    speed: 0.01 + i * 0.002,
                });

                scene.add(pyramid);
            }

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0xffffff, 0.9);
            pointLight.position.set(3, 3, 3);
            scene.add(pointLight);

            const pointLight2 = new THREE.PointLight(0x7c3aed, 0.5);
            pointLight2.position.set(-3, -3, 3);
            scene.add(pointLight2);

            let animationId: number;
            const animate = () => {
                animationId = requestAnimationFrame(animate);

                pyramids.forEach((pyr) => {
                    pyr.time += pyr.speed;

                    // Floating motion
                    pyr.mesh.position.y = pyr.initialY + Math.sin(pyr.time) * 1.5;
                    pyr.mesh.position.z = pyr.initialZ + Math.cos(pyr.time * 0.7) * 1.5;

                    // Rotation
                    pyr.mesh.rotation.x += 0.006;
                    pyr.mesh.rotation.y += 0.008;
                    pyr.mesh.rotation.z += 0.004;

                    // Scale pulsing
                    const scale = 1 + Math.sin(pyr.time * 1.5) * 0.15;
                    pyr.mesh.scale.set(scale, scale, scale);
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
