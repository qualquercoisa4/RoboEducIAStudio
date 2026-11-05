"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type ItemId =
  | "dirt" | "oak_log" | "oak_planks" | "stick" | "cobblestone" | "coal"
  | "iron_ore" | "copper_ore" | "redstone" | "iron_ingot" | "copper_ingot"
  | "crafting_table" | "furnace" | "torch" | "apple" | "robot_bench" | "robot_core";

type BlockType =
  | "grass" | "dirt" | "stone" | "oak_log" | "leaves" | "coal_ore"
  | "iron_ore_block" | "copper_ore_block" | "redstone_ore_block" | "bedrock"
  | "oak_planks" | "cobblestone" | "crafting_table" | "furnace" | "torch" | "robot_bench";

type Recipe = {
  id: string;
  title: string;
  description: string;
  icon: string;
  costs: Partial<Record<ItemId, number>>;
  output: ItemId;
  amount: number;
  needsTable?: boolean;
  needsFurnace?: boolean;
  needsRobotBench?: boolean;
};

type InputState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
};

const ITEM_NAMES: Record<ItemId, string> = {
  dirt: "Terra",
  oak_log: "Tronco de carvalho",
  oak_planks: "Tábuas",
  stick: "Graveto",
  cobblestone: "Pedregulho",
  coal: "Carvão",
  iron_ore: "Minério de ferro",
  copper_ore: "Minério de cobre",
  redstone: "Redstone",
  iron_ingot: "Barra de ferro",
  copper_ingot: "Barra de cobre",
  crafting_table: "Bancada de trabalho",
  furnace: "Fornalha",
  torch: "Tocha",
  apple: "Maçã",
  robot_bench: "Bancada RoboEduc",
  robot_core: "Núcleo robótico",
};

const ITEM_ICONS: Record<ItemId, string> = {
  dirt: "🟫",
  oak_log: "🪵",
  oak_planks: "🟨",
  stick: "🪵",
  cobblestone: "🪨",
  coal: "⚫",
  iron_ore: "⛏️",
  copper_ore: "🟠",
  redstone: "🔴",
  iron_ingot: "🔩",
  copper_ingot: "🟤",
  crafting_table: "🧰",
  furnace: "🔥",
  torch: "🕯️",
  apple: "🍎",
  robot_bench: "🤖",
  robot_core: "💠",
};

const HOTBAR: ItemId[] = [
  "dirt", "oak_planks", "cobblestone", "crafting_table",
  "furnace", "torch", "apple", "robot_bench",
];

const STARTING_INVENTORY: Record<ItemId, number> = {
  dirt: 0,
  oak_log: 0,
  oak_planks: 0,
  stick: 0,
  cobblestone: 0,
  coal: 0,
  iron_ore: 0,
  copper_ore: 0,
  redstone: 0,
  iron_ingot: 0,
  copper_ingot: 0,
  crafting_table: 0,
  furnace: 0,
  torch: 0,
  apple: 0,
  robot_bench: 0,
  robot_core: 0,
};

const RECIPES: Recipe[] = [
  {
    id: "planks", title: "Tábuas de madeira", description: "Transforma troncos em material de construção.",
    icon: "🪵", costs: { oak_log: 1 }, output: "oak_planks", amount: 4,
  },
  {
    id: "sticks", title: "Gravetos", description: "Dois pedaços de madeira viram quatro gravetos.",
    icon: "🥢", costs: { oak_planks: 2 }, output: "stick", amount: 4,
  },
  {
    id: "table", title: "Bancada de trabalho", description: "Desbloqueia receitas de ferramentas e estruturas.",
    icon: "🧰", costs: { oak_planks: 4 }, output: "crafting_table", amount: 1,
  },
  {
    id: "torch", title: "Tochas", description: "Ilumine seu abrigo e dificulte a aproximação de monstros.",
    icon: "🕯️", costs: { coal: 1, stick: 1 }, output: "torch", amount: 4, needsTable: true,
  },
  {
    id: "furnace", title: "Fornalha", description: "Use a fornalha para processar minérios.",
    icon: "🔥", costs: { cobblestone: 8 }, output: "furnace", amount: 1, needsTable: true,
  },
  {
    id: "iron", title: "Barra de ferro", description: "Funda minério de ferro usando carvão.",
    icon: "🔩", costs: { iron_ore: 1, coal: 1 }, output: "iron_ingot", amount: 1, needsTable: true, needsFurnace: true,
  },
  {
    id: "copper", title: "Barra de cobre", description: "Funda minério de cobre usando carvão.",
    icon: "🟤", costs: { copper_ore: 1, coal: 1 }, output: "copper_ingot", amount: 1, needsTable: true, needsFurnace: true,
  },
  {
    id: "robotBench", title: "Bancada RoboEduc", description: "Estação tecnológica para construir componentes eletrônicos.",
    icon: "🤖", costs: { oak_planks: 4, copper_ingot: 2, iron_ingot: 1 }, output: "robot_bench", amount: 1, needsTable: true,
  },
  {
    id: "robotCore", title: "Núcleo robótico", description: "Componente tecnológico avançado feito com metais e redstone.",
    icon: "💠", costs: { copper_ingot: 2, iron_ingot: 1, redstone: 1 }, output: "robot_core", amount: 1, needsTable: true, needsRobotBench: true,
  },
];

const BLOCK_COLORS: Record<BlockType, number> = {
  grass: 0x70ad47,
  dirt: 0x89603c,
  stone: 0x858b91,
  oak_log: 0x80502d,
  leaves: 0x438b43,
  coal_ore: 0x555b63,
  iron_ore_block: 0xb18b78,
  copper_ore_block: 0xb76d4d,
  redstone_ore_block: 0x8e4747,
  bedrock: 0x34383d,
  oak_planks: 0xb88751,
  cobblestone: 0x777d82,
  crafting_table: 0x976039,
  furnace: 0x646b70,
  torch: 0xffd15a,
  robot_bench: 0x397e91,
};

const BLOCK_DROPS: Partial<Record<BlockType, ItemId>> = {
  grass: "dirt",
  dirt: "dirt",
  stone: "cobblestone",
  oak_log: "oak_log",
  coal_ore: "coal",
  iron_ore_block: "iron_ore",
  copper_ore_block: "copper_ore",
  redstone_ore_block: "redstone",
  oak_planks: "oak_planks",
  cobblestone: "cobblestone",
  crafting_table: "crafting_table",
  furnace: "furnace",
  torch: "torch",
  robot_bench: "robot_bench",
};

const PLACEABLE_BLOCKS: Partial<Record<ItemId, BlockType>> = {
  dirt: "dirt",
  oak_planks: "oak_planks",
  cobblestone: "cobblestone",
  crafting_table: "crafting_table",
  furnace: "furnace",
  torch: "torch",
  robot_bench: "robot_bench",
};

const keyOf = (x: number, y: number, z: number) => [x, y, z].join(",");
const terrainHeight = (x: number, z: number) =>
  4 + Math.round(
    Math.sin(x * 0.19) * 0.8 +
    Math.cos(z * 0.17) * 0.8 +
    Math.sin((x + z) * 0.11) * 0.5
  );

const seeded = (x: number, y: number, z: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

export default function MinecraftSurvival({ gameName, onExit }: { gameName: string; onExit: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const inputRef = useRef<InputState>({ forward: false, backward: false, left: false, right: false, jump: false });
  const inventoryRef = useRef<Record<ItemId, number>>({ ...STARTING_INVENTORY });
  const selectedRef = useRef(0);
  const actionsRef = useRef<{ mine?: () => void; place?: () => void; eat?: () => void }>({});
  const [inventory, setInventory] = useState<Record<ItemId, number>>({ ...STARTING_INVENTORY });
  const [selected, setSelected] = useState(0);
  const [hud, setHud] = useState({ health: 20, hunger: 20, day: 1, clock: "08:00", night: false });
  const vitalsRef = useRef({ health: 20, hunger: 20 });
  const startedRef = useRef(false);
  const gameOverRef = useRef(false);
  const inventoryOpenRef = useRef(false);
  const craftOpenRef = useRef(false);
  const craftingTableAvailableRef = useRef(false);
  const furnaceAvailableRef = useRef(false);
  const robotBenchAvailableRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [craftOpen, setCraftOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState("Colete madeira, minério e sobreviva à noite.");
  const [gameOver, setGameOver] = useState(false);
  const [restart, setRestart] = useState(0);
  const [worldReady, setWorldReady] = useState(false);

  const changeVitals = (healthDelta = 0, hungerDelta = 0) => {
    const next = {
      health: Math.max(0, Math.min(20, vitalsRef.current.health + healthDelta)),
      hunger: Math.max(0, Math.min(20, vitalsRef.current.hunger + hungerDelta)),
    };
    vitalsRef.current = next;
    setHud((value) => ({ ...value, health: next.health, hunger: next.hunger }));
    if (next.health <= 0 && !gameOverRef.current) {
      gameOverRef.current = true;
      setGameOver(true);
    }
  };

  const toggleInventory = () => {
    const next = !inventoryOpenRef.current;
    inventoryOpenRef.current = next;
    if (next) { craftOpenRef.current = false; setCraftOpen(false); }
    setInventoryOpen(next);
  };

  const toggleCrafting = () => {
    const next = !craftOpenRef.current;
    craftOpenRef.current = next;
    if (next) { inventoryOpenRef.current = false; setInventoryOpen(false); }
    setCraftOpen(next);
  };

  const updateInventory = (item: ItemId, amount: number) => {
    const next = { ...inventoryRef.current };
    next[item] = Math.max(0, (next[item] || 0) + amount);
    inventoryRef.current = next;
    setInventory(next);
  };

  const craft = (recipe: Recipe) => {
    const current = inventoryRef.current;
    if (recipe.needsTable && current.crafting_table < 1 && !craftingTableAvailableRef.current) {
      setNotice("Você precisa ter uma bancada de trabalho no inventário.");
      return;
    }
    if (recipe.needsFurnace && current.furnace < 1 && !furnaceAvailableRef.current) {
      setNotice("Você precisa fabricar e colocar uma fornalha.");
      return;
    }
    if (recipe.needsRobotBench && current.robot_bench < 1 && !robotBenchAvailableRef.current) {
      setNotice("Você precisa fabricar e colocar a Bancada RoboEduc.");
      return;
    }
    const possible = Object.entries(recipe.costs).every(([id, amount]) =>
      (current[id as ItemId] || 0) >= (amount || 0)
    );
    if (!possible) {
      setNotice("Faltam materiais para essa receita.");
      return;
    }
    const next = { ...current };
    Object.entries(recipe.costs).forEach(([id, amount]) => {
      next[id as ItemId] = Math.max(0, next[id as ItemId] - (amount || 0));
    });
    next[recipe.output] = (next[recipe.output] || 0) + recipe.amount;
    inventoryRef.current = next;
    setInventory(next);
    setNotice("Fabricado: " + recipe.amount + "x " + ITEM_NAMES[recipe.output] + ".");
  };

  const chooseSlot = (index: number) => {
    const next = Math.max(0, Math.min(HOTBAR.length - 1, index));
    selectedRef.current = next;
    setSelected(next);
  };

  const startGame = () => {
    startedRef.current = true;
    setStarted(true);
    window.setTimeout(() => {
      const renderer = rendererRef.current;
      if (renderer && renderer.domElement.requestPointerLock && window.matchMedia("(pointer:fine)").matches) {
        renderer.domElement.requestPointerLock();
      }
    }, 50);
  };

  const restartGame = () => {
    inventoryRef.current = { ...STARTING_INVENTORY };
    setInventory({ ...STARTING_INVENTORY });
    selectedRef.current = 0;
    setSelected(0);
    vitalsRef.current = { health: 20, hunger: 20 };
    startedRef.current = false;
    gameOverRef.current = false;
    inventoryOpenRef.current = false;
    craftOpenRef.current = false;
    craftingTableAvailableRef.current = false;
    furnaceAvailableRef.current = false;
    robotBenchAvailableRef.current = false;
    setHud({ health: 20, hunger: 20, day: 1, clock: "08:00", night: false });
    setGameOver(false);
    setStarted(false);
    setInventoryOpen(false);
    setCraftOpen(false);
    setRestart((value) => value + 1);
  };

  const eatApple = () => {
    const current = inventoryRef.current;
    if (current.apple < 1) {
      setNotice("Você não tem comida. Procure maçãs nas árvores.");
      return;
    }
    if (vitalsRef.current.hunger >= 20) {
      setNotice("Sua barra de fome já está cheia.");
      return;
    }
    updateInventory("apple", -1);
    changeVitals(0, 6);
    setNotice("Maçã consumida. A fome foi recuperada.");
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setNotice("Não foi possível iniciar o WebGL neste navegador ou dispositivo.");
      return;
    }

    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x82c8f0, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x82c8f0);
    scene.fog = new THREE.Fog(0x82c8f0, 18, 58);
    const camera = new THREE.PerspectiveCamera(76, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 100);
    camera.rotation.order = "YXZ";

    const hemisphere = new THREE.HemisphereLight(0xd8edff, 0x65734d, 1.25);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.65);
    sun.position.set(25, 45, 18);
    scene.add(sun);

    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const blockMaterials: Record<BlockType, THREE.MeshLambertMaterial> = {} as Record<BlockType, THREE.MeshLambertMaterial>;
    const blockTextures: THREE.CanvasTexture[] = [];
    const makePixelTexture = (type: BlockType) => {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext("2d");
      if (!context) return null;
      const base = BLOCK_COLORS[type];
      const red = (base >> 16) & 255;
      const green = (base >> 8) & 255;
      const blue = base & 255;
      context.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
      context.fillRect(0, 0, 16, 16);
      const salt = type.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      for (let i = 0; i < 74; i++) {
        const px = Math.floor(seeded(salt, i, 3) * 16);
        const py = Math.floor(seeded(salt, i, 7) * 16);
        const shade = seeded(salt, i, 11) > 0.52 ? 1.18 : 0.78;
        const r = Math.max(0, Math.min(255, Math.round(red * shade)));
        const g = Math.max(0, Math.min(255, Math.round(green * shade)));
        const b = Math.max(0, Math.min(255, Math.round(blue * shade)));
        context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        context.fillRect(px, py, 1 + (i % 7 === 0 ? 1 : 0), 1);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestMipmapNearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      blockTextures.push(texture);
      return texture;
    };
    (Object.keys(BLOCK_COLORS) as BlockType[]).forEach((type) => {
      blockMaterials[type] = new THREE.MeshLambertMaterial({
        map: makePixelTexture(type),
        color: 0xffffff,
        transparent: type === "leaves",
        opacity: type === "leaves" ? 0.92 : 1,
      });
    });

    const blocks = new Map<string, BlockType>();
    const worldMeshes: THREE.InstancedMesh[] = [];
    const blockPositions = new THREE.Object3D();
    const raycaster = new THREE.Raycaster();
    raycaster.far = 6.5;
    const center = new THREE.Vector2(0, 0);
    const highlightGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025, 1.025, 1.025));
    const highlight = new THREE.LineSegments(
      highlightGeometry,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false })
    );
    highlight.visible = false;
    highlight.renderOrder = 10;
    scene.add(highlight);

    const putBlock = (x: number, y: number, z: number, type: BlockType) => {
      blocks.set(keyOf(x, y, z), type);
    };

    for (let x = -22; x <= 22; x++) {
      for (let z = -22; z <= 22; z++) {
        const height = terrainHeight(x, z);
        for (let y = -4; y <= height; y++) {
          let type: BlockType = y === -4 ? "bedrock" : y === height ? "grass" : y >= height - 2 ? "dirt" : "stone";
          if (type === "stone" && y > -4) {
            const roll = seeded(x, y, z);
            if (roll > 0.991) type = "redstone_ore_block";
            else if (roll > 0.979) type = "copper_ore_block";
            else if (roll > 0.966) type = "iron_ore_block";
            else if (roll > 0.95) type = "coal_ore";
          }
          putBlock(x, y, z, type);
        }
      }
    }

    for (let x = -20; x <= 20; x++) {
      for (let z = -20; z <= 20; z++) {
        if (Math.abs(x) < 6 && Math.abs(z) < 6) continue;
        if (Math.abs(x) < 3 || Math.abs(z) < 3) continue;
        if (seeded(x, 2, z) < 0.966) continue;
        const ground = terrainHeight(x, z);
        for (let y = ground + 1; y <= ground + 4; y++) putBlock(x, y, z, "oak_log");
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 3; dy <= 5; dy++) {
              if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 4) > 5) continue;
              const px = x + dx, py = ground + dy, pz = z + dz;
              if (!blocks.has(keyOf(px, py, pz))) putBlock(px, py, pz, "leaves");
            }
          }
        }
      }
    }

    const rebuildWorld = () => {
      worldMeshes.forEach((mesh) => {
        scene.remove(mesh);
        mesh.dispose();
      });
      worldMeshes.length = 0;
      const grouped = new Map<BlockType, Array<{ x: number; y: number; z: number }>>();
      blocks.forEach((type, key) => {
        const values = key.split(",").map(Number);
        const list = grouped.get(type) || [];
        list.push({ x: values[0], y: values[1], z: values[2] });
        grouped.set(type, list);
      });
      grouped.forEach((positions, type) => {
        const mesh = new THREE.InstancedMesh(cubeGeometry, blockMaterials[type], positions.length);
        mesh.userData.blockPositions = positions;
        positions.forEach((position, index) => {
          blockPositions.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
          blockPositions.updateMatrix();
          mesh.setMatrixAt(index, blockPositions.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        scene.add(mesh);
        worldMeshes.push(mesh);
      });
    };
    rebuildWorld();

    const dayColor = new THREE.Color(0x82c8f0);
    const nightColor = new THREE.Color(0x101a39);
    const skyColor = new THREE.Color();
    const spawnX = 0;
    const spawnZ = 0;
    const spawnY = terrainHeight(spawnX, spawnZ) + 1.01;
    const player = { x: spawnX + 0.5, y: spawnY, z: spawnZ + 0.5, vy: 0, grounded: false, yaw: 0, pitch: 0 };
    const keys = inputRef.current;
    let worldSeconds = 80;
    let hungerTimer = 0;
    let hungerDamageTimer = 0;
    let regenerationTimer = 0;
    let spawnTimer = 0;
    let mobDamageCooldown = 0;
    let hudTimer = 0;
    let lastTime = performance.now();
    let animationFrame = 0;
    let destroyed = false;
    let touchPointer: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;

    type Mob = { group: THREE.Group; attack: number; health: number };
    const mobs: Mob[] = [];
    const mobGeometry = new THREE.BoxGeometry(0.62, 0.72, 0.42);
    const mobHeadGeometry = new THREE.BoxGeometry(0.58, 0.58, 0.58);
    const mobBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4d9862 });
    const mobHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x70a46b });
    const mobEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xf5e7d0 });
    const spawnMob = () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 12 + Math.random() * 5;
      const x = Math.round(player.x + Math.cos(angle) * distance);
      const z = Math.round(player.z + Math.sin(angle) * distance);
      const y = terrainHeight(x, z) + 1;
      const group = new THREE.Group();
      const body = new THREE.Mesh(mobGeometry, mobBodyMaterial);
      body.position.y = 0.68;
      const head = new THREE.Mesh(mobHeadGeometry, mobHeadMaterial);
      head.position.y = 1.32;
      const eyeA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), mobEyeMaterial);
      eyeA.position.set(-0.14, 1.36, -0.3);
      const eyeB = eyeA.clone();
      eyeB.position.x = 0.14;
      group.add(body, head, eyeA, eyeB);
      group.position.set(x + 0.5, y, z + 0.5);
      scene.add(group);
      mobs.push({ group, attack: 0, health: 3 });
    };

    const collidesAt = (x: number, y: number, z: number) => {
      const minX = Math.floor(x - 0.29), maxX = Math.floor(x + 0.29);
      const minZ = Math.floor(z - 0.29), maxZ = Math.floor(z + 0.29);
      const minY = Math.floor(y + 0.03), maxY = Math.floor(y + 1.76);
      for (let bx = minX; bx <= maxX; bx++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          for (let by = minY; by <= maxY; by++) {
            if (blocks.has(keyOf(bx, by, bz))) return true;
          }
        }
      }
      return false;
    };

    const addDrop = (item: ItemId, amount = 1) => {
      updateInventory(item, amount);
    };

    const currentTarget = () => {
      raycaster.setFromCamera(center, camera);
      const hits = raycaster.intersectObjects(worldMeshes, false);
      if (!hits.length) return null;
      const hit = hits[0];
      const instanceId = hit.instanceId;
      if (instanceId === undefined) return null;
      const positions = hit.object.userData.blockPositions as Array<{ x: number; y: number; z: number }>;
      const position = positions[instanceId];
      if (!position) return null;
      return { hit, position, type: blocks.get(keyOf(position.x, position.y, position.z)) || "bedrock" as BlockType };
    };

    const mineBlock = () => {
      if (!startedRef.current || gameOverRef.current || inventoryOpenRef.current || craftOpenRef.current) return;
      raycaster.setFromCamera(center, camera);
      const mobHits = raycaster.intersectObjects(mobs.map((mob) => mob.group), true);
      if (mobHits.length) {
        const hitMob = mobs.find((mob) => mob.group === mobHits[0].object || mob.group.children.includes(mobHits[0].object));
        if (hitMob && mobHits[0].distance < 5.5) {
          hitMob.health -= 1;
          if (hitMob.health <= 0) {
            scene.remove(hitMob.group);
            hitMob.group.clear();
            setNotice("Zumbi derrotado.");
          } else {
            setNotice("Você acertou o zumbi. Continue atacando.");
          }
          return;
        }
      }
      const target = currentTarget();
      if (!target || target.type === "bedrock") return;
      const position = target.position;
      const id = keyOf(position.x, position.y, position.z);
      const type = blocks.get(id);
      if (!type) return;
      blocks.delete(id);
      rebuildWorld();
      const drop = BLOCK_DROPS[type];
      if (drop) addDrop(drop);
      if (type === "leaves" && Math.random() < 0.16) addDrop("apple");
      if (type === "leaves" && Math.random() < 0.08) addDrop("oak_log");
      setNotice(drop ? "+1 " + ITEM_NAMES[drop] : "Bloco removido.");
    };

    const placeBlock = () => {
      if (!startedRef.current || gameOverRef.current || inventoryOpenRef.current || craftOpenRef.current) return;
      const target = currentTarget();
      if (!target || !target.hit.face) return;
      const item = HOTBAR[selectedRef.current];
      if (item === "apple") {
        eatApple();
        return;
      }
      const blockType = PLACEABLE_BLOCKS[item];
      if (!blockType || (inventoryRef.current[item] || 0) < 1) {
        setNotice("Selecione um bloco que esteja no inventário.");
        return;
      }
      const normal = target.hit.face.normal;
      const x = target.position.x + Math.round(normal.x);
      const y = target.position.y + Math.round(normal.y);
      const z = target.position.z + Math.round(normal.z);
      if (y < -3 || y > 24 || Math.abs(x) > 23 || Math.abs(z) > 23 || blocks.has(keyOf(x, y, z))) return;
      const overlapsPlayer =
        Math.abs(x + 0.5 - player.x) < 0.48 &&
        Math.abs(z + 0.5 - player.z) < 0.48 &&
        y < player.y + 1.8 && y + 1 > player.y;
      if (overlapsPlayer) {
        setNotice("Não é possível colocar um bloco dentro do personagem.");
        return;
      }
      putBlock(x, y, z, blockType);
      rebuildWorld();
      if (item === "crafting_table") craftingTableAvailableRef.current = true;
      if (item === "furnace") furnaceAvailableRef.current = true;
      if (item === "robot_bench") robotBenchAvailableRef.current = true;
      updateInventory(item, -1);
      setNotice(ITEM_NAMES[item] + " colocado.");
    };

    const eatSelected = () => eatApple();
    actionsRef.current = { mine: mineBlock, place: placeBlock, eat: eatSelected };

    const updateCamera = () => {
      camera.position.set(player.x, player.y + 1.62, player.z);
      camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    };

    const updateHighlight = () => {
      const target = currentTarget();
      if (!target) {
        highlight.visible = false;
        return;
      }
      highlight.position.set(target.position.x + 0.5, target.position.y + 0.5, target.position.z + 0.5);
      highlight.visible = true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
      if (key === "w" || key === "arrowup") keys.forward = true;
      if (key === "s" || key === "arrowdown") keys.backward = true;
      if (key === "a" || key === "arrowleft") keys.left = true;
      if (key === "d" || key === "arrowright") keys.right = true;
      if (key === " ") keys.jump = true;
      if (key >= "1" && key <= "8") chooseSlot(Number(key) - 1);
      if (key === "e" && !event.repeat) toggleInventory();
      if (key === "c" && !event.repeat) toggleCrafting();
      if (key === "f") eatApple();
      if (key === "escape" && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.forward = false;
      if (key === "s" || key === "arrowdown") keys.backward = false;
      if (key === "a" || key === "arrowleft") keys.left = false;
      if (key === "d" || key === "arrowright") keys.right = false;
      if (key === " ") keys.jump = false;
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      player.yaw -= event.movementX * 0.0022;
      player.pitch -= event.movementY * 0.0022;
      player.pitch = Math.max(-1.48, Math.min(1.48, player.pitch));
    };
    const onPointerLock = () => setLocked(document.pointerLockElement === renderer.domElement);
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) mineBlock();
      if (event.button === 2) placeBlock();
    };
    const onContextMenu = (event: Event) => event.preventDefault();
    const onTouchStart = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      touchPointer = event.pointerId;
      lastTouchX = event.clientX;
      lastTouchY = event.clientY;
    };
    const onTouchMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || touchPointer !== event.pointerId) return;
      const dx = event.clientX - lastTouchX;
      const dy = event.clientY - lastTouchY;
      player.yaw -= dx * 0.006;
      player.pitch -= dy * 0.006;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch));
      lastTouchX = event.clientX;
      lastTouchY = event.clientY;
    };
    const onTouchEnd = (event: PointerEvent) => {
      if (touchPointer === event.pointerId) touchPointer = null;
    };

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    renderer.domElement.addEventListener("click", () => {
      if (startedRef.current && window.matchMedia("(pointer:fine)").matches && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }
    });
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("pointerdown", onTouchStart);
    renderer.domElement.addEventListener("pointermove", onTouchMove);
    renderer.domElement.addEventListener("pointerup", onTouchEnd);
    renderer.domElement.addEventListener("pointercancel", onTouchEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLock);
    window.addEventListener("resize", resize);
    resize();

    const animate = (now: number) => {
      if (destroyed) return;
      const dt = Math.min(0.04, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (startedRef.current && !gameOverRef.current && !inventoryOpenRef.current && !craftOpenRef.current) {
        const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        let moveX = 0, moveZ = 0;
        if (keys.forward) { moveX += forward.x; moveZ += forward.z; }
        if (keys.backward) { moveX -= forward.x; moveZ -= forward.z; }
        if (keys.right) { moveX += right.x; moveZ += right.z; }
        if (keys.left) { moveX -= right.x; moveZ -= right.z; }
        const length = Math.hypot(moveX, moveZ) || 1;
        moveX = (moveX / length) * 4.4 * dt;
        moveZ = (moveZ / length) * 4.4 * dt;
        if (!collidesAt(player.x + moveX, player.y, player.z)) player.x += moveX;
        if (!collidesAt(player.x, player.y, player.z + moveZ)) player.z += moveZ;

        player.x = Math.max(-21.4, Math.min(21.4, player.x));
        player.z = Math.max(-21.4, Math.min(21.4, player.z));

        if (keys.jump && player.grounded) {
          player.vy = 8.1;
          player.grounded = false;
        }
        const oldY = player.y;
        player.vy -= 22 * dt;
        const nextY = player.y + player.vy * dt;
        if (!collidesAt(player.x, nextY, player.z)) {
          player.y = nextY;
          player.grounded = false;
        } else {
          if (player.vy < 0) {
            player.y = Math.floor(nextY) + 1.001;
            player.grounded = true;
          } else {
            player.y = oldY;
          }
          player.vy = 0;
        }
        if (player.y < -12) {
          player.x = spawnX + 0.5;
          player.z = spawnZ + 0.5;
          player.y = spawnY;
          player.vy = 0;
          changeVitals(-5, 0);
          setNotice("Você caiu muito fundo e voltou ao ponto inicial.");
        }

        worldSeconds += dt;
        const dayLength = 240;
        const day = Math.floor(worldSeconds / dayLength) + 1;
        const phase = (worldSeconds % dayLength) / dayLength;
        const night = phase > 0.76 || phase < 0.24;
        const hours = Math.floor(phase * 24);
        const minutes = Math.floor(((phase * 24) % 1) * 60);
        const clock = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
        const daylight = Math.max(0.12, Math.min(1, Math.sin((phase - 0.25) * Math.PI * 2) * 0.5 + 0.5));
        sun.intensity = 0.12 + daylight * 1.65;
        hemisphere.intensity = 0.22 + daylight * 1.1;
        skyColor.lerpColors(nightColor, dayColor, daylight);
        scene.background = skyColor;
        if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(skyColor);

        hungerTimer += dt;
        if (hungerTimer >= 28) {
          hungerTimer = 0;
          changeVitals(0, -1);
        }
        hungerDamageTimer += dt;
        if (vitalsRef.current.hunger <= 0 && hungerDamageTimer >= 11) {
          hungerDamageTimer = 0;
          changeVitals(-1, 0);
        }
        regenerationTimer += dt;
        if (vitalsRef.current.hunger >= 18 && regenerationTimer >= 9 && vitalsRef.current.health < 20) {
          regenerationTimer = 0;
          changeVitals(1, 0);
        }

        spawnTimer += dt;
        if (night && spawnTimer > 13 && mobs.length < 5) {
          spawnTimer = 0;
          spawnMob();
        }
        mobDamageCooldown = Math.max(0, mobDamageCooldown - dt);
        mobs.forEach((mob) => {
          const dx = player.x - mob.group.position.x;
          const dz = player.z - mob.group.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 17 && distance > 1.05) {
            mob.group.position.x += (dx / distance) * 1.05 * dt;
            mob.group.position.z += (dz / distance) * 1.05 * dt;
            mob.group.rotation.y = Math.atan2(dx, dz);
          } else if (distance <= 1.05 && mobDamageCooldown <= 0) {
            mobDamageCooldown = 1.25;
            changeVitals(-2, 0);
            player.x -= (dx / Math.max(0.1, distance)) * 0.45;
            player.z -= (dz / Math.max(0.1, distance)) * 0.45;
            setNotice("Um zumbi acertou você. Afaste-se ou construa abrigo.");
          }
          mob.group.position.y = terrainHeight(Math.round(mob.group.position.x), Math.round(mob.group.position.z)) + 1;
        });
        mobs.forEach((mob) => {
          if (mob.health <= 0 || Math.hypot(mob.group.position.x - player.x, mob.group.position.z - player.z) > 35) {
            scene.remove(mob.group);
            mob.group.clear();
          }
        });
        for (let i = mobs.length - 1; i >= 0; i--) {
          if (mobs[i].group.children.length === 0) mobs.splice(i, 1);
        }

        updateCamera();
        updateHighlight();
        hudTimer += dt;
        if (hudTimer > 0.25) {
          hudTimer = 0;
          setHud((value) => ({ ...value, day, clock, night }));
        }
      }

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    setWorldReady(true);

    return () => {
      destroyed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointerlockchange", onPointerLock);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      renderer.domElement.removeEventListener("pointerdown", onTouchStart);
      renderer.domElement.removeEventListener("pointermove", onTouchMove);
      renderer.domElement.removeEventListener("pointerup", onTouchEnd);
      renderer.domElement.removeEventListener("pointercancel", onTouchEnd);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      scene.clear();
      cubeGeometry.dispose();
      highlightGeometry.dispose();
      Object.values(blockMaterials).forEach((material) => material.dispose());
      blockTextures.forEach((texture) => texture.dispose());
      mobGeometry.dispose();
      mobHeadGeometry.dispose();
      mobBodyMaterial.dispose();
      mobHeadMaterial.dispose();
      mobEyeMaterial.dispose();
      keys.forward = keys.backward = keys.left = keys.right = keys.jump = false;
    };
  }, [restart]);

  const setMove = (direction: keyof InputState, value: boolean) => {
    inputRef.current[direction] = value;
  };

  const canCraft = (recipe: Recipe) => {
    if (recipe.needsTable && inventory.crafting_table < 1 && !craftingTableAvailableRef.current) return false;
    if (recipe.needsFurnace && inventory.furnace < 1 && !furnaceAvailableRef.current) return false;
    if (recipe.needsRobotBench && inventory.robot_bench < 1 && !robotBenchAvailableRef.current) return false;
    return Object.entries(recipe.costs).every(([id, amount]) => inventory[id as ItemId] >= (amount || 0));
  };

  const selectedItem = HOTBAR[selected];
  const selectedAmount = inventory[selectedItem] || 0;

  return (
    <main className="mc-game">
      <div className="mc-viewport" ref={mountRef} />
      <div className="mc-crosshair"><span /><span /></div>

      <header className="mc-topbar">
        <div className="mc-title">
          <strong>{gameName}</strong>
          <small>MUNDO DE SOBREVIVÊNCIA</small>
        </div>
        <div className="mc-vitals">
          <div className="mc-vital">
            <span>VIDA</span>
            <div className="mc-meter"><i className="mc-health" style={{ width: (hud.health / 20) * 100 + "%" }} /></div>
            <b>{hud.health}/20</b>
          </div>
          <div className="mc-vital">
            <span>FOME</span>
            <div className="mc-meter"><i className="mc-hunger" style={{ width: (hud.hunger / 20) * 100 + "%" }} /></div>
            <b>{hud.hunger}/20</b>
          </div>
        </div>
        <div className="mc-world-time">
          <b>DIA {hud.day}</b>
          <span>{hud.night ? "🌙" : "☀️"} {hud.clock}</span>
          <button onClick={onExit}>SAIR</button>
        </div>
      </header>

      <div className="mc-left-tip">
        <b>{hud.night ? "A noite chegou" : "Sobreviva e construa"}</b>
        <span>{hud.night ? "Zumbis aparecem no escuro." : "Colete madeira e prepare seu abrigo."}</span>
      </div>

      {notice && <div className="mc-notice">{notice}</div>}

      <div className="mc-hotbar">
        {HOTBAR.map((item, index) => (
          <button
            key={item}
            className={selected === index ? "selected" : ""}
            onClick={() => chooseSlot(index)}
            aria-label={"Selecionar " + ITEM_NAMES[item]}
          >
            <small>{index + 1}</small>
            <span>{ITEM_ICONS[item]}</span>
            <b>{inventory[item] || 0}</b>
          </button>
        ))}
      </div>

      <div className="mc-action-hints">
        <span><kbd>W A S D</kbd> mover</span>
        <span><kbd>ESPAÇO</kbd> pular</span>
        <span><kbd>CLIQUE</kbd> minerar</span>
        <span><kbd>BOTÃO DIREITO</kbd> colocar</span>
        <span><kbd>E</kbd> inventário</span>
        <span><kbd>C</kbd> fabricar</span>
      </div>

      <div className="mc-mobile-left">
        <div className="mc-dpad">
          <button onPointerDown={() => setMove("forward", true)} onPointerUp={() => setMove("forward", false)} onPointerLeave={() => setMove("forward", false)} onPointerCancel={() => setMove("forward", false)}>▲</button>
          <div>
            <button onPointerDown={() => setMove("left", true)} onPointerUp={() => setMove("left", false)} onPointerLeave={() => setMove("left", false)} onPointerCancel={() => setMove("left", false)}>◀</button>
            <button onPointerDown={() => setMove("backward", true)} onPointerUp={() => setMove("backward", false)} onPointerLeave={() => setMove("backward", false)} onPointerCancel={() => setMove("backward", false)}>▼</button>
            <button onPointerDown={() => setMove("right", true)} onPointerUp={() => setMove("right", false)} onPointerLeave={() => setMove("right", false)} onPointerCancel={() => setMove("right", false)}>▶</button>
          </div>
        </div>
      </div>

      <div className="mc-mobile-actions">
        <button className="mc-mine" onPointerDown={() => actionsRef.current.mine?.()}>MINERAR</button>
        <button className="mc-place" onPointerDown={() => actionsRef.current.place?.()}>COLOCAR</button>
        <button className="mc-jump" onPointerDown={() => setMove("jump", true)} onPointerUp={() => setMove("jump", false)} onPointerLeave={() => setMove("jump", false)} onPointerCancel={() => setMove("jump", false)}>PULAR</button>
        <button className="mc-eat" onPointerDown={eatApple}>COMER</button>
      </div>

      <div className="mc-side-actions">
        <button onClick={() => setInventoryOpen((value) => !value)}>INVENTÁRIO <kbd>E</kbd></button>
        <button onClick={() => setCraftOpen((value) => !value)}>FABRICAÇÃO <kbd>C</kbd></button>
        <button onClick={eatApple}>COMER <kbd>F</kbd></button>
      </div>

      {inventoryOpen && (
        <div className="mc-modal-backdrop" onClick={() => setInventoryOpen(false)}>
          <section className="mc-panel" onClick={(event) => event.stopPropagation()}>
            <div className="mc-panel-heading">
              <div><small>MOCHILA</small><h2>Inventário</h2></div>
              <button onClick={() => setInventoryOpen(false)}>✕</button>
            </div>
            <div className="mc-inventory-grid">
              {(Object.keys(ITEM_NAMES) as ItemId[]).map((item) => (
                <div className="mc-inventory-item" key={item}>
                  <span>{ITEM_ICONS[item]}</span>
                  <div><b>{ITEM_NAMES[item]}</b><small>{inventory[item]} unidades</small></div>
                </div>
              ))}
            </div>
            <p className="mc-panel-note">Use as teclas 1–8 ou toque na barra inferior para selecionar um item.</p>
          </section>
        </div>
      )}

      {craftOpen && (
        <div className="mc-modal-backdrop" onClick={() => setCraftOpen(false)}>
          <section className="mc-panel mc-crafting-panel" onClick={(event) => event.stopPropagation()}>
            <div className="mc-panel-heading">
              <div><small>RECEITAS</small><h2>Fabricação</h2></div>
              <button onClick={() => setCraftOpen(false)}>✕</button>
            </div>
            {RECIPES.map((recipe) => (
              <div className="mc-recipe" key={recipe.id}>
                <span className="mc-recipe-icon">{recipe.icon}</span>
                <div className="mc-recipe-info">
                  <b>{recipe.title}</b>
                  <small>{recipe.description}</small>
                  <em>{Object.entries(recipe.costs).map(([id, amount]) => (amount + "x " + ITEM_NAMES[id as ItemId])).join(" · ")}</em>
                </div>
                <button disabled={!canCraft(recipe)} onClick={() => craft(recipe)}>CRIAR ×{recipe.amount}</button>
              </div>
            ))}
            <p className="mc-panel-note">Comece minerando madeira. Depois fabrique uma bancada, uma fornalha e só então processe os minérios para construir a Bancada RoboEduc.</p>
          </section>
        </div>
      )}

      {!started && (
        <div className="mc-start-screen">
          <div className="mc-start-card">
            <span className="mc-start-kicker">ROBOEDUC · MODO SOBREVIVÊNCIA</span>
            <h1>Um mundo em blocos.<br />Uma aventura sua.</h1>
            <p>Explore, minere, construa seu abrigo e sobreviva ao ciclo de dia e noite. Crie também sua Bancada RoboEduc e desenvolva um núcleo robótico.</p>
            <div className="mc-start-controls">
              <span><b>W A S D</b> mover</span>
              <span><b>Mouse</b> olhar</span>
              <span><b>Botão esquerdo</b> minerar</span>
              <span><b>Botão direito</b> colocar blocos</span>
            </div>
            <button disabled={!worldReady} onClick={startGame}>{worldReady ? "ENTRAR NO MUNDO" : "CRIANDO O MUNDO..."}</button>
            <small>Melhor experiência em tela horizontal. No celular, arraste o cenário para olhar e use os controles na tela.</small>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="mc-start-screen mc-game-over">
          <div className="mc-start-card">
            <span className="mc-start-kicker">FIM DE JOGO</span>
            <h1>Sua aventura terminou.</h1>
            <p>Você não conseguiu sobreviver. Recomece para tentar construir um abrigo melhor antes da noite.</p>
            <button onClick={restartGame}>GERAR NOVO MUNDO</button>
            <button className="mc-secondary" onClick={onExit}>VOLTAR AO ESTÚDIO</button>
          </div>
        </div>
      )}
    </main>
  );
}
