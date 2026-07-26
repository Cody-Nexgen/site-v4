import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BarChart3, X } from 'lucide-react';
import {
    type DisplayTree,
    type ForestState,
    FOREST_STORAGE_KEY,
    computeDisplay,
    emptyForest,
    loadForest,
} from '../lib/forest';

const SPLASH_KEY = 'focuznow-forest-3d-splash';
const TUTORIAL_KEY = 'focuznow-forest-3d-tutorial';

type Props = {
    onBack: () => void;
    onOpenStats: () => void;
};

function treeColor(species: string): { trunk: number; leaves: number } {
    switch (species) {
        case 'pine':
            return { trunk: 0x6b4a32, leaves: 0x2d6a4f };
        case 'oak':
            return { trunk: 0x7a5236, leaves: 0x40916c };
        case 'birch':
            return { trunk: 0xd4cbb8, leaves: 0x52b788 };
        case 'cherry':
            return { trunk: 0x74504a, leaves: 0xe07a9a };
        default:
            return { trunk: 0x5c4033, leaves: 0x2d6a4f };
    }
}

function addTreeMesh(group: THREE.Group, tree: DisplayTree, wx: number, wz: number) {
    const scale = 0.4 + (tree.stageIndex + tree.progress) * 0.35;
    const colors = treeColor(tree.species);

    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15 * scale, 0.22 * scale, 1.8 * scale, 6),
        new THREE.MeshStandardMaterial({ color: colors.trunk, roughness: 0.9 }),
    );
    trunk.position.set(wx, 0.9 * scale, wz);
    trunk.castShadow = true;
    group.add(trunk);

    const foliage = new THREE.Mesh(
        tree.species === 'pine'
            ? new THREE.ConeGeometry(1.1 * scale, 2.4 * scale, 7)
            : new THREE.SphereGeometry(1.0 * scale, 8, 8),
        new THREE.MeshStandardMaterial({ color: colors.leaves, roughness: 0.75 }),
    );
    foliage.position.set(wx, 2.2 * scale, wz);
    foliage.castShadow = true;
    group.add(foliage);
}

export default function ForestWorld3D({ onBack, onOpenStats }: Props) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<ForestState>(() => emptyForest());
    const [showSplash, setShowSplash] = useState(() => !localStorage.getItem(SPLASH_KEY));
    const [tutorialStep, setTutorialStep] = useState(() =>
        localStorage.getItem(TUTORIAL_KEY) ? -1 : 0,
    );
    const keysRef = useRef<Record<string, boolean>>({});
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        void loadForest().then(setState);
        const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
            if (changes[FOREST_STORAGE_KEY]?.newValue) {
                setState(changes[FOREST_STORAGE_KEY].newValue as ForestState);
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, []);

    const dismissSplash = () => {
        localStorage.setItem(SPLASH_KEY, '1');
        setShowSplash(false);
    };

    const advanceTutorial = () => {
        if (tutorialStep >= 2) {
            localStorage.setItem(TUTORIAL_KEY, '1');
            setTutorialStep(-1);
        } else {
            setTutorialStep((s) => s + 1);
        }
    };

    const initScene = useCallback(() => {
        const mount = mountRef.current;
        if (!mount) return () => {};

        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87b8d8);
        scene.fog = new THREE.Fog(0xb8d4e8, 40, 220);

        const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
        camera.position.set(0, 4, 12);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xddeeff, 0x3d5c3a, 0.85));
        const sun = new THREE.DirectionalLight(0xfff4d6, 1.1);
        sun.position.set(40, 80, 30);
        sun.castShadow = true;
        scene.add(sun);

        const grassCanvas = document.createElement('canvas');
        grassCanvas.width = 256;
        grassCanvas.height = 256;
        const ctx = grassCanvas.getContext('2d')!;
        ctx.fillStyle = '#2d5a3d';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 8000; i++) {
            const g = 35 + Math.random() * 40;
            ctx.fillStyle = `rgb(${Math.floor(g * 0.4)},${Math.floor(g)},${Math.floor(g * 0.55)})`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 2 + Math.random() * 3);
        }
        const grassTex = new THREE.CanvasTexture(grassCanvas);
        grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(80, 80);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(800, 800),
            new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const treeGroup = new THREE.Group();
        scene.add(treeGroup);

        const player = { x: 0, z: 0, yaw: 0, pitch: 0 };
        let pointerLocked = false;

        const onKeyDown = (e: KeyboardEvent) => {
            keysRef.current[e.code] = true;
        };
        const onKeyUp = (e: KeyboardEvent) => {
            keysRef.current[e.code] = false;
        };
        const onClick = () => {
            if (!pointerLocked) renderer.domElement.requestPointerLock();
        };
        const onLock = () => {
            pointerLocked = document.pointerLockElement === renderer.domElement;
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!pointerLocked) return;
            player.yaw -= e.movementX * 0.002;
            player.pitch -= e.movementY * 0.002;
            player.pitch = Math.max(-0.6, Math.min(0.5, player.pitch));
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        renderer.domElement.addEventListener('click', onClick);
        document.addEventListener('pointerlockchange', onLock);
        document.addEventListener('mousemove', onMouseMove);

        let frame = 0;
        let raf = 0;
        const animate = () => {
            frame++;
            const speed = 0.14;
            const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
            const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
            if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) {
                player.x += fwd.x * speed;
                player.z += fwd.z * speed;
            }
            if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) {
                player.x -= fwd.x * speed;
                player.z -= fwd.z * speed;
            }
            if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
                player.x -= right.x * speed;
                player.z -= right.z * speed;
            }
            if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
                player.x += right.x * speed;
                player.z += right.z * speed;
            }

            camera.position.set(player.x, 4, player.z + 0.01);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = player.yaw;
            camera.rotation.x = player.pitch;

            if (frame % 30 === 0) {
                while (treeGroup.children.length) treeGroup.remove(treeGroup.children[0]);
                const display = computeDisplay(stateRef.current, Date.now());
                for (const t of display.trees) {
                    const wx = t.gx * 4 + (t.gx % 2) * 0.5;
                    const wz = t.gy * 4 + (t.gy % 2) * 0.5;
                    if (Math.hypot(wx - player.x, wz - player.z) < 140) {
                        addTreeMesh(treeGroup, t, wx, wz);
                    }
                }
            }

            renderer.render(scene, camera);
            raf = requestAnimationFrame(animate);
        };
        animate();

        const onResize = () => {
            const nw = mount.clientWidth;
            const nh = mount.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('pointerlockchange', onLock);
            document.removeEventListener('mousemove', onMouseMove);
            renderer.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
    }, []);

    useEffect(() => {
        if (showSplash) return;
        return initScene();
    }, [showSplash, initScene]);

    const tutorialLines = [
        'Welcome to your infinite focus forest.',
        'Click the world to capture your mouse. Use WASD to explore forever.',
        'Complete focus sessions to plant trees. Check stats anytime from the HUD.',
    ];

    return (
        <div className="fixed inset-0 z-[250] bg-[#0a0f0c]">
            <div ref={mountRef} className="absolute inset-0" />

            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pointer-events-none">
                <button
                    type="button"
                    onClick={onBack}
                    className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm font-semibold"
                >
                    <ArrowLeft size={16} /> Exit forest
                </button>
                <button
                    type="button"
                    onClick={onOpenStats}
                    className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-emerald-300 text-sm font-semibold"
                >
                    <BarChart3 size={16} /> Stats
                </button>
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/45 backdrop-blur text-[11px] text-neutral-300 border border-white/8 pointer-events-none">
                WASD move · Click to look · Trees grow while you stay focused
            </div>

            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-[#1a2f1f] to-[#0a0f0c]"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center px-8 max-w-md">
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                className="text-6xl mb-6"
                            >
                                🌲
                            </motion.div>
                            <h1 className="text-3xl font-black text-white mb-3">Your Forest Awaits</h1>
                            <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                                An infinite 3D world that grows with every focus session.
                            </p>
                            <button type="button" onClick={dismissSplash} className="focuz-btn-primary px-8 py-3 text-base">
                                Enter the forest
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {tutorialStep >= 0 && !showSplash && (
                <div className="absolute inset-0 z-20 flex items-end justify-center p-8 pointer-events-none">
                    <div className="pointer-events-auto relative max-w-md w-full focuz-surface-card p-5 border-emerald-500/20">
                        <button
                            type="button"
                            className="absolute top-3 right-3 text-neutral-500 hover:text-white"
                            onClick={() => {
                                localStorage.setItem(TUTORIAL_KEY, '1');
                                setTutorialStep(-1);
                            }}
                        >
                            <X size={16} />
                        </button>
                        <p className="text-sm text-neutral-300 leading-relaxed pr-6">{tutorialLines[tutorialStep]}</p>
                        <button type="button" className="focuz-btn-primary mt-4 w-full" onClick={advanceTutorial}>
                            {tutorialStep >= 2 ? 'Start exploring' : 'Next'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
