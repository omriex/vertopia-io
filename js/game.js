
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
        import { getDatabase, ref, set, push, remove, update as fbUpdate, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
        import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

        const versionEl = document.querySelector('.version-text');
        const CURRENT_VERSION = versionEl ? versionEl.innerText.trim() : 'v1.0.0';

        setInterval(async () => {
            try {
                let res = await fetch('https://raw.githubusercontent.com/omriex/vertopia-io/main/index.html?t=' + Date.now(), { cache: 'no-store' });
                let text = await res.text();
                let match = text.match(/<div class="version-text">(v[\d\.]+)<\/div>/);
                if (match && match[1] !== CURRENT_VERSION) {
                    window.location.reload(true);
                }
            } catch (e) {}
        }, 10000);

        const firebaseConfig = {
            apiKey: "AIzaSyDcx4fwRtS_ebOZPKqYvniR_4W-uEt0zi4",
            authDomain: "vertopia-io.firebaseapp.com",
            databaseURL: "https://vertopia-io-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "vertopia-io",
            storageBucket: "vertopia-io.firebasestorage.app",
            messagingSenderId: "503764652487",
            appId: "1:503764652487:web:dbe6b8b5b6c1777c0189e2"
        };

        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);
        const googleProvider = new GoogleAuthProvider();
        
        let serverTimeOffset = 0;
        onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
            serverTimeOffset = snap.val() || 0;
        });
        function getServerTime() { return Date.now() + serverTimeOffset; }
        
        const myPlayerId = Math.random().toString(36).substring(2, 15);
        const myPlayerRef = ref(db, `players/${myPlayerId}`);
        const droppedItemsRef = ref(db, 'droppedItems');
        
        let otherPlayers = {};
        
        onDisconnect(myPlayerRef).remove();

        const playersRef = ref(db, 'players');
        onValue(playersRef, (snapshot) => {
            const data = snapshot.val();
            let validIds = new Set();
            allPlayers = [{ name: player.name }];
            
            if (data) {
                const realNow = getServerTime();
                
                for (let id in data) {
                    if (id === myPlayerId) {
                        if (data[id].hitEvent && data[id].hitEvent.t !== player.lastHitT) {
                            player.lastHitT = data[id].hitEvent.t;
                            player.health -= data[id].hitEvent.d;
                            player.damageNegationTimer = 0.2;
                            player.lastDamageTime = realNow;
                            
                            let hitAngle = data[id].hitEvent.ang !== undefined ? data[id].hitEvent.ang : 0;
                            
                            if (player.isBlocking) {
                                player.kbVx = Math.cos(hitAngle) * 300;
                                player.kbVy = Math.sin(hitAngle) * 300;
                            } else {
                                player.kbVx = Math.cos(hitAngle) * 120;
                                player.kbVy = Math.sin(hitAngle) * 120;
                            }
                            
                            playSoundInstance(assets.damageSounds, player.x + player.width / 2, player.y + player.height / 2);
                            
                            if (player.health <= 0 && !player.dead) {
                                player.health = 0;
                                player.dead = true;
                                player.deathTimer = 0.15;
                                player.killedBy = data[id].hitEvent.a;
                                player.forceSync = true;
                                
                                gameState = 'DEAD';
                                document.getElementById('mainMenu').style.display = 'flex';
                                
                                document.getElementById('inventory').style.display = 'none';
                                document.getElementById('leaderboardContainer').style.display = 'none';
                                document.getElementById('minimapContainer').style.display = 'none';
                                document.getElementById('statsContainer').style.display = 'none';
                                document.getElementById('coordsContainer').style.display = 'none';
                                document.getElementById('perfContainer').style.display = 'none';
                                document.getElementById('craftBtnContainer').style.display = 'none';
                                document.getElementById('homeBtnContainer').style.display = 'none';
                                document.getElementById('craftingUI').style.display = 'none';
                                document.getElementById('chatInputContainer').style.display = 'none';
                            }
                        }
                        continue;
                    }
                    
                    let remoteT = data[id].t || 0;
                    if (realNow - remoteT > 10000) {
                        continue;
                    }
                    
                    if (!otherPlayers[id]) {
                        otherPlayers[id] = {
                            x: data[id].x,
                            y: data[id].y,
                            angle: data[id].angle,
                            targetX: data[id].x,
                            targetY: data[id].y,
                            targetAngle: data[id].angle,
                            sprint: data[id].sprint || false,
                            name: data[id].name,
                            isOwner: data[id].isOwner || false,
                            attackCounter: data[id].attack || 0,
                            equippedItem: data[id].equippedItem || null,
                            swingTimer: 0,
                            nextHand: 'right',
                            footstepTimer: 0,
                            particleTimer: 0,
                            currentStepSound: null,
                            chatMessages: [],
                            lastChatT: 0,
                            blocking: data[id].blocking || false,
                            blockAmount: 0,
                            lastHitT: 0,
                            health: data[id].health !== undefined ? data[id].health : 100,
                            dead: (data[id].health !== undefined ? data[id].health : 100) <= 0,
                            deathTimer: 0,
                            swimTransition: 0
                        };
                    } else {
                        otherPlayers[id].targetX = data[id].x;
                        otherPlayers[id].targetY = data[id].y;
                        otherPlayers[id].targetAngle = data[id].angle;
                        otherPlayers[id].sprint = data[id].sprint || false;
                        otherPlayers[id].name = data[id].name;
                        otherPlayers[id].isOwner = data[id].isOwner || false;
                        otherPlayers[id].blocking = data[id].blocking || false;
                        
                        otherPlayers[id].equippedItem = data[id].equippedItem || null;
                        
                        if (data[id].health !== undefined) {
                            otherPlayers[id].health = data[id].health;
                            if (data[id].health <= 0 && !otherPlayers[id].dead) {
                                otherPlayers[id].dead = true;
                                otherPlayers[id].deathTimer = 0.15;
                            } else if (data[id].health > 0) {
                                otherPlayers[id].dead = false;
                            }
                        }
                        
                        if (data[id].attack !== undefined && data[id].attack !== otherPlayers[id].attackCounter) {
                            otherPlayers[id].attackCounter = data[id].attack;
                            otherPlayers[id].swingTimer = 0.001;
                            let px = otherPlayers[id].x + player.width / 2;
                            let py = otherPlayers[id].y + player.height / 2;
                            playSound(assets.swingSound, px, py);
                        }
                        
                        if (data[id].chat && data[id].chat.t !== otherPlayers[id].lastChatT) {
                            otherPlayers[id].chatMessages.push({
                                msg: data[id].chat.msg,
                                timer: 4.0,
                                maxTime: 4.0
                            });
                            if (otherPlayers[id].chatMessages.length > 3) {
                                otherPlayers[id].chatMessages.shift();
                            }
                            otherPlayers[id].lastChatT = data[id].chat.t;
                        }

                        if (data[id].hitEvent && data[id].hitEvent.t !== otherPlayers[id].lastHitT) {
                            otherPlayers[id].lastHitT = data[id].hitEvent.t;
                            playSoundInstance(assets.damageSounds, otherPlayers[id].x + player.width / 2, otherPlayers[id].y + player.height / 2);
                        }
                    }
                    
                    validIds.add(id);
                    allPlayers.push({ name: data[id].name || "Vertopian" });
                }
            }
            
            for (let id in otherPlayers) {
                if (!validIds.has(id)) {
                    delete otherPlayers[id];
                }
            }

            if (gameState === 'PLAYING' || gameState === 'DEAD') {
                updateLeaderboardUI();
            }
        });

        const treesRef = ref(db, 'trees');
        let firstTreeSync = true;
        onValue(treesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                for (let id in data) {
                    if (trees.has(id)) {
                        let t = trees.get(id);
                        let serverData = data[id];
                        let serverHp = serverData.hp;
                        
                        if (serverHp < t.hp) {
                            t.hp = serverHp;
                            t.hitAngle = serverData.a || 0;
                            
                            if (!firstTreeSync) {
                                t.hitTimer = 0.2;
                                activeTrees.add(t);
                                if (t.hp <= 0 && !t.dead) {
                                    t.dead = true;
                                    t.deathTimer = 0.5;
                                    playSoundInstance(assets.treeHits, t.cx, t.cy);
                                } else if (t.hp > 0) {
                                    playSoundInstance(assets.treeHits, t.cx, t.cy);
                                }
                            } else {
                                if (t.hp <= 0) {
                                    t.hp = 0;
                                    t.dead = true;
                                    t.deathTimer = 0;
                                }
                            }
                        }
                    }
                }
            }
            firstTreeSync = false;
        });

        window.addEventListener('contextmenu', e => e.preventDefault());

        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const playBtn = document.getElementById('playBtn');
        const mainMenu = document.getElementById('mainMenu');
        
        const locationOverlay = document.getElementById('locationOverlay');
        const spawnMenuUI = document.getElementById('spawnMenuUI');
        const btnCloseSpawnMenu = document.getElementById('smCloseBtn');
        
        const inventory = document.getElementById('inventory');
        const inventorySlots = document.querySelectorAll('#inventory .inventory-slot');
        const craftingInventorySlots = document.querySelectorAll('#craftingInventory .inventory-slot');
        
        const nameInput = document.getElementById('playerNameInput');
        const leaderboardContainer = document.getElementById('leaderboardContainer');
        const leaderboardList = document.getElementById('leaderboardList');
        const leaderboardToggleBtn = document.getElementById('leaderboardToggleBtn');
        const listWrapper = document.getElementById('listWrapper');
        const minimapContainer = document.getElementById('minimapContainer');
        const minimapCanvas = document.getElementById('minimapCanvas');
        const minCtx = minimapCanvas.getContext('2d');
        const statsContainer = document.getElementById('statsContainer');
        const energyFill = document.getElementById('energyFill');
        const healthFill = document.getElementById('healthFill');
        
        const coordsContainer = document.getElementById('coordsContainer');
        const coordX = document.getElementById('coordX');
        const coordZ = document.getElementById('coordZ');

        const inputRegX = document.getElementById('smRegX');
        const inputRegZ = document.getElementById('smRegZ');

        let width, height;
        function resize() {
            let dpr = window.devicePixelRatio || 1;
            width = Math.round(window.innerWidth * dpr);
            height = Math.round(window.innerHeight * dpr);
            
            canvas.width = width;
            canvas.height = height;
            ctx.imageSmoothingEnabled = false; 
            
            const uiLayer = document.getElementById('uiLayer');
            uiLayer.style.width = `${width}px`;
            uiLayer.style.height = `${height}px`;
            uiLayer.style.transform = `scale(${1 / dpr})`;
            uiLayer.style.transformOrigin = '0 0';
        }
        window.addEventListener('resize', resize);
        resize();

        let gameState = 'MENU'; 
        let menuAngle = 0; 
        const TILE_SIZE = 64; 
        
        const MAP_COLS = 5000; 
        const MAP_ROWS = 5000; 
        const MAP_CENTER = 2500;

        const mapData = new Uint8Array(MAP_COLS * MAP_ROWS);
        const waterTiles = [];
        const trees = new Map();
        const activeTrees = new Set();

        function generateMap() {
            let mapSeed = 54321;
            function seededRandom() {
                mapSeed = (mapSeed * 9301 + 49297) % 233280;
                return mapSeed / 233280;
            }

            function paintBlob(cx, cy, radius, tileType) {
                for (let y = -radius; y <= radius; y++) {
                    for (let x = -radius; x <= radius; x++) {
                        if (Math.abs(x) + Math.abs(y) <= radius) {
                            let mapX = Math.round(cx + x);
                            let mapY = Math.round(cy + y);
                            if (mapX >= 0 && mapX < MAP_COLS && mapY >= 0 && mapY < MAP_ROWS) {
                                let idx = mapY * MAP_COLS + mapX;
                                if (mapData[idx] !== tileType) {
                                    mapData[idx] = tileType;
                                    if (tileType === 1) waterTiles.push(idx);
                                }
                            }
                        }
                    }
                }
            }

            let numVerticalRivers = 50;
            let numHorizontalRivers = 50;
            for (let i = 0; i < numVerticalRivers; i++) {
                let startX1 = seededRandom() * (MAP_COLS - 20) + 10;
                let phase1 = seededRandom() * Math.PI * 2;
                let phase2 = seededRandom() * Math.PI * 2;
                for (let y = 0; y < MAP_ROWS; y++) {
                    let x = startX1 + Math.sin(y * 0.15 + phase1) * 6 + Math.cos(y * 0.05 + phase2) * 4;
                    paintBlob(x, y, 2, 1); 
                }
            }
            for (let i = 0; i < numHorizontalRivers; i++) {
                let startY2 = seededRandom() * (MAP_ROWS - 20) + 10;
                let phase3 = seededRandom() * Math.PI * 2;
                let phase4 = seededRandom() * Math.PI * 2;
                for (let x = 0; x < MAP_COLS; x++) {
                    let y = startY2 + Math.sin(x * 0.15 + phase3) * 6 + Math.cos(x * 0.05 + phase4) * 4;
                    paintBlob(x, y, 2, 1);
                }
            }
            for (let i = 0; i < waterTiles.length; i++) {
                let idx = waterTiles[i];
                let x = idx % MAP_COLS;
                let y = Math.floor(idx / MAP_COLS);
                for (let ny = -2; ny <= 2; ny++) {
                    for (let nx = -2; nx <= 2; nx++) {
                        if (nx * nx + ny * ny <= 4.84) { 
                            let mapX = x + nx;
                            let mapY = y + ny;
                            if (mapX >= 0 && mapX < MAP_COLS && mapY >= 0 && mapY < MAP_ROWS) {
                                let nIdx = mapY * MAP_COLS + mapX;
                                if (mapData[nIdx] === 0) mapData[nIdx] = 2; 
                            }
                        }
                    }
                }
            }

            for (let y = 0; y < MAP_ROWS - 1; y += 6) {
                for (let x = 0; x < MAP_COLS - 1; x += 6) {
                    if (seededRandom() < 0.95) { 
                        let ox = Math.floor(seededRandom() * 5);
                        let oy = Math.floor(seededRandom() * 5);
                        let tx = x + ox;
                        let ty = y + oy;
                        
                        if (tx < MAP_COLS - 1 && ty < MAP_ROWS - 1) {
                            if (mapData[ty * MAP_COLS + tx] === 0 &&
                                mapData[ty * MAP_COLS + tx + 1] === 0 &&
                                mapData[(ty + 1) * MAP_COLS + tx] === 0 &&
                                mapData[(ty + 1) * MAP_COLS + tx + 1] === 0) {
                                
                                let maxHp = 5 + Math.floor(seededRandom() * 6);
                                let baseScale = 0.8 + ((maxHp - 5) / 5) * 0.4;
                                let rot = seededRandom() * Math.PI * 2;
                                let treeId = tx + "_" + ty;
                                trees.set(treeId, {
                                    id: treeId,
                                    x: tx * TILE_SIZE,
                                    y: ty * TILE_SIZE,
                                    cx: tx * TILE_SIZE + TILE_SIZE,
                                    cy: ty * TILE_SIZE + TILE_SIZE,
                                    hp: maxHp,
                                    maxHp: maxHp,
                                    baseScale: baseScale,
                                    rot: rot,
                                    hitAngle: 0,
                                    hitTimer: 0,
                                    deathTimer: 0,
                                    dead: false,
                                    visibleState: 0,
                                    inView: false
                                });
                            }
                        }
                    }
                }
            }
        }
        generateMap();

        let currentZoom = 1.0; 
        let targetZoom = 1.0;
        const MIN_ZOOM = 1.0; 
        const MAX_ZOOM = 2.5;

        const cameraPanOffset = { x: 0, y: 0 };
        const MAX_PAN = 60; 

        let particles = [];
        let previewX = MAP_CENTER * TILE_SIZE;
        let previewZ = MAP_CENTER * TILE_SIZE;

        const player = {
            name: "Vertopian", 
            x: 0, 
            y: 0,
            width: 48, 
            height: 48,
            handSize: 19, 
            speed: 192, 
            angle: 0,
            health: 100,
            energy: 100,
            regenDelay: 0, 
            exhausted: false,
            sprintActive: false,
            swingTimer: 0,
            swingDuration: 0.216, 
            swingCooldown: 0.35,
            inventory: ['rock', null, null, null, null],
            equippedSlot: 0,
            cooldownTimer: 0,
            nextHand: 'right',
            footstepTimer: 0,
            currentStepSound: null,
            particleTimer: 0,
            attackCounter: 0,
            chatMessages: [],
            chatPayload: null,
            forceSync: false,
            isBlocking: false,
            blockAmount: 0,
            swimTransition: 0,
            damageNegationTimer: 0,
            lastHitT: 0,
            dead: false,
            deathTimer: 0,
            killedBy: null,
            kbVx: 0,
            kbVy: 0,
            lastDamageTime: getServerTime()
        };

        let activeSlot = 0; 
        let allPlayers = [];
        
        let localDroppedItems = [];
        let globalDroppedItems = {};
        
        onValue(droppedItemsRef, (snapshot) => {
            globalDroppedItems = snapshot.val() || {};
        });
        
        function dropItem(itemType, fromX, fromY, angle) {
            let speed = 200 + Math.random() * 100;
            localDroppedItems.push({
                type: itemType,
                x: fromX,
                y: fromY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                timer: 0
            });
        }
        
        function pickupItem(type) {
            let mainSlots = document.querySelectorAll('#inventory .inventory-slot');
            for (let slot of mainSlots) {
                if (!slot.querySelector('.item-img')) {
                    let img = document.createElement('img');
                    img.src = `assets/${type}.png`;
                    img.className = 'item-img';
                    img.setAttribute('data-name', type.charAt(0).toUpperCase() + type.slice(1));
                    img.setAttribute('data-desc', `A good ${type}.`);
                    slot.appendChild(img);
                    return true;
                }
            }
            let craftSlots = document.querySelectorAll('#craftingInventory .inventory-slot');
            for (let slot of craftSlots) {
                if (!slot.querySelector('.item-img')) {
                    let img = document.createElement('img');
                    img.src = `assets/${type}.png`;
                    img.className = 'item-img';
                    img.setAttribute('data-name', type.charAt(0).toUpperCase() + type.slice(1));
                    img.setAttribute('data-desc', `A good ${type}.`);
                    slot.appendChild(img);
                    return true;
                }
            }
            return false;
        }

        const keys = { w: false, a: false, s: false, d: false, shift: false };
        const mouse = { x: width / 2, y: height / 2 };
        let isMouseDown = false; 
        let isRightMouseDown = false;

        let spawnGridX = 0;
        let spawnGridZ = 0;
        let selectedRegX = 0;
        let selectedRegZ = 0;
        let lastSyncTime = 0;
        let lastAngle = 0;

        function applyRegionBounds(val) {
            return Math.max(-25, Math.min(25, val));
        }

        function updateSpawnInfo() {
            inputRegX.value = selectedRegX;
            inputRegZ.value = selectedRegZ;
            document.getElementById('smLocX').innerText = selectedRegX * 100;
            document.getElementById('smLocZ').innerText = selectedRegZ * 100;
        }

        function renderSpawnGrid() {
            const grid = document.getElementById('sm-grid');
            grid.innerHTML = '';
            for (let z = -2; z <= 2; z++) {
                for (let x = -2; x <= 2; x++) {
                    let rX = spawnGridX + x;
                    let rZ = spawnGridZ + z;
                    let cell = document.createElement('div');
                    cell.className = 'sm-grid-cell';
                    if (rX === selectedRegX && rZ === selectedRegZ) cell.classList.add('active');
                    cell.innerHTML = `<span>${rX} X</span><span>${rZ} Z</span>`;
                    
                    if (rX < -25 || rX > 25 || rZ < -25 || rZ > 25) {
                        cell.classList.add('disabled');
                    } else {
                        cell.onclick = () => {
                            selectedRegX = rX;
                            selectedRegZ = rZ;
                            updateSpawnInfo();
                            renderSpawnGrid();
                        };
                    }
                    grid.appendChild(cell);
                }
            }
        }

        inputRegX.addEventListener('change', (e) => {
            selectedRegX = applyRegionBounds(parseInt(e.target.value) || 0);
            spawnGridX = selectedRegX;
            updateSpawnInfo();
            renderSpawnGrid();
        });

        inputRegZ.addEventListener('change', (e) => {
            selectedRegZ = applyRegionBounds(parseInt(e.target.value) || 0);
            spawnGridZ = selectedRegZ;
            updateSpawnInfo();
            renderSpawnGrid();
        });

        document.getElementById('smUp').onclick = () => { spawnGridZ--; renderSpawnGrid(); };
        document.getElementById('smDown').onclick = () => { spawnGridZ++; renderSpawnGrid(); };
        document.getElementById('smLeft').onclick = () => { spawnGridX--; renderSpawnGrid(); };
        document.getElementById('smRight').onclick = () => { spawnGridX++; renderSpawnGrid(); };

        btnCloseSpawnMenu.addEventListener('click', () => {
            spawnMenuUI.style.display = 'none';
            mainMenu.style.display = 'flex';
            gameState = 'MENU';
        });

        function updateLeaderboardUI() {
            leaderboardList.innerHTML = '';
            allPlayers.forEach(p => {
                const li = document.createElement('li');
                li.innerText = p.name;
                leaderboardList.appendChild(li);
            });
        }

        function startGameAtRegion(rx, rz) {
            let spawnTileX = MAP_CENTER + rx * 100;
            let spawnTileY = MAP_CENTER + rz * 100; 

            spawnTileX = Math.max(10, Math.min(MAP_COLS - 10, spawnTileX));
            spawnTileY = Math.max(10, Math.min(MAP_ROWS - 10, spawnTileY));

            let found = false;
            for (let r = 0; r < 50; r++) {
                for (let t = 0; t < Math.PI * 2; t += 0.5) {
                    let testX = Math.floor(spawnTileX + Math.cos(t) * r);
                    let testY = Math.floor(spawnTileY + Math.sin(t) * r);
                    if (testX >= 0 && testX < MAP_COLS && testY >= 0 && testY < MAP_ROWS) {
                        if (mapData[testY * MAP_COLS + testX] === 0) {
                            spawnTileX = testX;
                            spawnTileY = testY;
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
            }

            player.x = spawnTileX * TILE_SIZE;
            player.y = spawnTileY * TILE_SIZE;
            player.dead = false;
            player.health = 100;
            player.energy = 100;
            player.damageNegationTimer = 0;
            player.lastDamageTime = getServerTime();

            set(myPlayerRef, {
                x: Math.round(player.x),
                y: Math.round(player.y),
                angle: 0,
                name: player.name,
                sprint: false,
                attack: 0,
                blocking: false,
                health: player.health,
                t: getServerTime()
            });

            spawnMenuUI.style.display = 'none';
            locationOverlay.style.display = 'none';
            inventory.style.display = 'flex'; 
            leaderboardContainer.style.display = 'block'; 
            minimapContainer.style.display = 'block';
            statsContainer.style.display = 'flex';
            coordsContainer.style.display = 'flex';
            document.getElementById('perfContainer').style.display = 'flex';
            document.getElementById('craftBtnContainer').style.display = 'flex';
            document.getElementById('homeBtnContainer').style.display = 'flex';
            
            updateLeaderboardUI();
            gameState = 'PLAYING';
        }

        document.getElementById('smPrev').onclick = () => {
            spawnMenuUI.style.display = 'none';
            locationOverlay.style.display = 'flex';
            gameState = 'PREVIEW';
            previewX = (selectedRegX * 100 + MAP_CENTER) * TILE_SIZE;
            previewZ = (selectedRegZ * 100 + MAP_CENTER) * TILE_SIZE;
        };

        document.getElementById('smRand').onclick = () => {
            selectedRegX = Math.floor(Math.random() * 51) - 25; 
            selectedRegZ = Math.floor(Math.random() * 51) - 25;
            spawnGridX = selectedRegX;
            spawnGridZ = selectedRegZ;
            updateSpawnInfo();
            renderSpawnGrid();
        };

        document.getElementById('btnPickLocation').onclick = () => {
            locationOverlay.style.display = 'none';
            spawnMenuUI.style.display = 'flex';
            gameState = 'SPAWN_PICKER';
        };

        document.getElementById('btnSpawnHere').onclick = () => {
            startGameAtRegion(selectedRegX, selectedRegZ);
        };

        function updateInventoryUI() {
            inventorySlots.forEach((slot, index) => {
                if (index === activeSlot) slot.classList.add('active');
                else slot.classList.remove('active');
            });
            craftingInventorySlots.forEach((slot, index) => {
                if (index === activeSlot) slot.classList.add('active');
                else slot.classList.remove('active');
            });
        }

        inventorySlots.forEach((slot, index) => {
            slot.addEventListener('mousedown', () => {
                if (gameState === 'PLAYING') {
                    activeSlot = index;
                    updateInventoryUI();
                }
            });
        });
        
        craftingInventorySlots.forEach((slot, index) => {
            slot.addEventListener('mousedown', () => {
                if (gameState === 'PLAYING') {
                    activeSlot = index;
                    updateInventoryUI();
                }
            });
        });

        let isLeaderboardVisible = true;
        function toggleLeaderboard() {
            isLeaderboardVisible = !isLeaderboardVisible;
            if (isLeaderboardVisible) {
                listWrapper.classList.remove('closed');
                leaderboardToggleBtn.classList.remove('up');
            } else {
                listWrapper.classList.add('closed');
                leaderboardToggleBtn.classList.add('up');
            }
        }
        leaderboardToggleBtn.addEventListener('click', toggleLeaderboard);

        let isChatting = false;

        window.addEventListener('keydown', (e) => {
            const key = e.key; 
            const lowerKey = key.toLowerCase();
            
            if (key === 'Enter') {
                if (gameState === 'PLAYING') {
                    if (isChatting) {
                        let msg = document.getElementById('chatInput').value.trim();
                        if (msg !== "") {
                            player.chatPayload = { msg: msg, t: getServerTime() };
                            player.chatMessages.push({ msg: msg, timer: 4.0, maxTime: 4.0 });
                            if (player.chatMessages.length > 3) player.chatMessages.shift();
                            player.forceSync = true;
                        }
                        document.getElementById('chatInput').value = "";
                        document.getElementById('chatInputContainer').style.display = 'none';
                        document.getElementById('chatInput').blur();
                        isChatting = false;
                        canvas.focus();
                    } else {
                        document.getElementById('chatInputContainer').style.display = 'block';
                        document.getElementById('chatInput').focus();
                        isChatting = true;
                        for (let k in keys) keys[k] = false;
                    }
                }
                return;
            }

            if (isChatting) return;

            if (key === 'Tab') {
                e.preventDefault(); 
                if (gameState === 'PLAYING') toggleLeaderboard();
            }
            if (lowerKey === 'e') {
                if (gameState === 'PLAYING') {
                    let ui = document.getElementById('craftingUI');
                    ui.style.display = (ui.style.display === 'none' || ui.style.display === '') ? 'flex' : 'none';
                }
            }
            if (gameState === 'PLAYING' && key >= '1' && key <= '5') {
                activeSlot = parseInt(key) - 1;
                updateInventoryUI();
            }
            if (keys.hasOwnProperty(lowerKey)) keys[lowerKey] = true;
        });

        window.addEventListener('keyup', (e) => {
            const lowerKey = e.key.toLowerCase();
            if (isChatting) return;
            if (keys.hasOwnProperty(lowerKey)) keys[lowerKey] = false;
        });

        window.addEventListener('mousemove', (e) => {
            let dpr = window.devicePixelRatio || 1;
            mouse.x = e.clientX * dpr;
            mouse.y = e.clientY * dpr;
        });

        function getVolume(x, y) {
            if (x === undefined || y === undefined) return 1.0;
            if (gameState !== 'PLAYING' && gameState !== 'DEAD') return 0;
            let dx = (player.x + player.width / 2) - x;
            let dy = (player.y + player.height / 2) - y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let maxDist = 800;
            if (dist > maxDist) return 0;
            return Math.max(0, 1.0 - (dist / maxDist));
        }

        function playSound(audioInstance, x, y) {
            let vol = getVolume(x, y);
            if (vol <= 0) return;
            let sound = audioInstance.cloneNode();
            sound.volume = vol;
            let playPromise = sound.play();
            if (playPromise !== undefined) playPromise.catch(e => {});
        }

        function playSoundInstance(audioArray, x, y) {
            if (!audioArray || audioArray.length === 0) return null;
            let vol = getVolume(x, y);
            if (vol <= 0) return null;
            let sound = audioArray[Math.floor(Math.random() * audioArray.length)].cloneNode();
            sound.volume = vol;
            let playPromise = sound.play();
            if (playPromise !== undefined) playPromise.catch(e => {});
            return sound;
        }

        function attemptAttack() {
            if (player.isWater) return;
            if (player.swingTimer <= 0 && player.cooldownTimer <= 0 && player.energy >= 5) {
                player.swingTimer = 0.001; 
                player.cooldownTimer = player.swingCooldown;
                player.attackCounter++;
                playSound(assets.swingSound, player.x + player.width / 2, player.y + player.height / 2);
                player.energy -= 5;
                player.regenDelay = Math.max(player.regenDelay, 1.5);
                if (player.energy <= 0) {
                    player.energy = 0;
                    player.exhausted = true;
                    player.regenDelay = 5.0;
                }

                let pCX = player.x + player.width / 2;
                let pCY = player.y + player.height / 2;
                let hitRange = 94;
                let hitArc = Math.PI / 1.5; 
                
                let closestTarget = null;
                let closestDist = Infinity;
                let targetType = null;
                
                let tileX = Math.floor(pCX / TILE_SIZE);
                let tileY = Math.floor(pCY / TILE_SIZE);
                
                for (let tr = tileY - 2; tr <= tileY + 2; tr++) {
                    for (let tc = tileX - 2; tc <= tileX + 2; tc++) {
                        let id = tc + "_" + tr;
                        if (trees.has(id)) {
                            let t = trees.get(id);
                            if (t.hp > 0) {
                                let tRadius = 48 * (t.baseScale || 1.0);
                                let dx = t.cx - pCX;
                                let dy = t.cy - pCY;
                                let distToTree = Math.sqrt(dx*dx + dy*dy);
                                let distToHitbox = distToTree - tRadius;
                                
                                if (distToHitbox <= hitRange) {
                                    let angleToTree = Math.atan2(t.cy - pCY, t.cx - pCX);
                                    let angleDiff = Math.abs(player.angle - angleToTree);
                                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                                    angleDiff = Math.abs(angleDiff);
                                    
                                    if (angleDiff <= hitArc / 2 && distToHitbox < closestDist) {
                                        closestDist = distToHitbox;
                                        closestTarget = t;
                                        targetType = 'tree';
                                    }
                                }
                            }
                        }
                    }
                }
                
                for (let id in otherPlayers) {
                    let op = otherPlayers[id];
                    if (op.dead) continue;
                    let opCX = op.x + player.width / 2;
                    let opCY = op.y + player.height / 2;
                    
                    let dx = opCX - pCX;
                    let dy = opCY - pCY;
                    let distToAABB = Math.sqrt(dx*dx + dy*dy);
                    
                    if (distToAABB <= hitRange) {
                        let angleToOp = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(player.angle - angleToOp);
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        angleDiff = Math.abs(angleDiff);
                        
                        if (angleDiff <= hitArc / 2 && distToAABB < closestDist) {
                            closestDist = distToAABB;
                            closestTarget = op;
                            closestTarget.id = id;
                            targetType = 'player';
                        }
                    }
                }
                
                if (targetType === 'tree') {
                    closestTarget.hp -= 1;
                    let angleToTree = Math.atan2(closestTarget.cy - pCY, closestTarget.cx - pCX);
                    closestTarget.hitTimer = 0.2;
                    closestTarget.hitAngle = angleToTree;
                    activeTrees.add(closestTarget);
                    
                    playSoundInstance(assets.treeHits, closestTarget.cx, closestTarget.cy);
                    
                    if (closestTarget.hp <= 0) {
                        closestTarget.dead = true;
                        closestTarget.deathTimer = 0.5;
                    }
                    
                    fbUpdate(ref(db), {
                        [`trees/${closestTarget.id}`]: {
                            hp: closestTarget.hp,
                            a: Number(angleToTree.toFixed(2))
                        }
                    }).catch(() => {});
                } else if (targetType === 'player') {
                    let damage = closestTarget.blocking ? 4 : 8;
                    if (player.damageNegationTimer > 0) damage = 0;
                    
                    fbUpdate(ref(db), {
                        [`players/${closestTarget.id}/hitEvent`]: {
                            d: damage,
                            t: getServerTime(),
                            a: myPlayerId,
                            ang: player.angle
                        }
                    }).catch(() => {});
                }
            }
        }

        window.addEventListener('blur', () => { 
            isMouseDown = false; 
            isRightMouseDown = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (gameState === 'PLAYING' && e.target === canvas) {
                if (e.button === 0) isMouseDown = true;
                if (e.button === 2) {
                    let pickedUp = false;
                    for (let key in globalDroppedItems) {
                        let item = globalDroppedItems[key];
                        let screenItemX = (width / 2) + (item.x - (player.x + player.width/2)) * currentZoom;
                        let screenItemY = (height / 2) + (item.y - (player.y + player.height/2)) * currentZoom;
                        let dx = mouse.x - screenItemX;
                        let dy = mouse.y - screenItemY;
                        if (Math.sqrt(dx*dx + dy*dy) < 40 * currentZoom && getServerTime() - item.t > 1500) {
                            if (pickupItem(item.type)) {
                                remove(ref(db, `droppedItems/${key}`));
                                pickedUp = true;
                                break;
                            }
                        }
                    }
                    if (!pickedUp) {
                        for (let i = localDroppedItems.length - 1; i >= 0; i--) {
                            let item = localDroppedItems[i];
                            let screenItemX = (width / 2) + (item.x - (player.x + player.width/2)) * currentZoom;
                            let screenItemY = (height / 2) + (item.y - (player.y + player.height/2)) * currentZoom;
                            let dx = mouse.x - screenItemX;
                            let dy = mouse.y - screenItemY;
                            if (Math.sqrt(dx*dx + dy*dy) < 40 * currentZoom && item.timer > 1.5) {
                                if (pickupItem(item.type)) {
                                    localDroppedItems.splice(i, 1);
                                    pickedUp = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (!pickedUp) isRightMouseDown = true;
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) isMouseDown = false;
            if (e.button === 2) isRightMouseDown = false;
        });

        window.addEventListener('wheel', (e) => {
            if (gameState !== 'PLAYING' && gameState !== 'PREVIEW') return;
            if (player && player.dead) return;
            let scrollDirection = e.deltaY > 0 ? -1 : 1; 
            let baseSpeed = 0.25;
            if (scrollDirection === 1) { 
                let distanceToMax = MAX_ZOOM - targetZoom;
                baseSpeed *= Math.max(0.1, distanceToMax); 
            } else {
                let distanceToMin = targetZoom - MIN_ZOOM;
                baseSpeed *= Math.max(0.1, distanceToMin);
            }
            targetZoom += scrollDirection * baseSpeed;
            targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
        });

        const assets = {
            tilesheet: new Image(),
            playerHead: new Image(),
            leftHand: new Image(),
            rightHand: new Image(),
            sprintParticle: new Image(),
            tree: new Image(),
            rock: new Image(),
            itemBackground: new Image(),
            swingSound: new Audio('audio/weapon-swing.mp3'),
            grassSteps: [
                new Audio('audio/grass-footstep-1.mp3'),
                new Audio('audio/grass-footstep-2.mp3'),
                new Audio('audio/grass-footstep-4.mp3')
            ],
            sandSteps: [
                new Audio('audio/sand-footstep-1.mp3'),
                new Audio('audio/sand-footstep-2.mp3'),
                new Audio('audio/sand-footstep-3.mp3'),
                new Audio('audio/sand-footstep-4.mp3')
            ],
            swimSounds: [
                new Audio('audio/swim-1.mp3'),
                new Audio('audio/swim-2.mp3')
            ],
            treeHits: [
                new Audio('audio/tree-hit-1.mp3'),
                new Audio('audio/tree-hit-2.mp3'),
                new Audio('audio/tree-hit-3.mp3')
            ],
            damageSounds: [
                new Audio('audio/damage-1.mp3'),
                new Audio('audio/damage-2.mp3'),
                new Audio('audio/damage-3.mp3')
            ]
        };

        let gameLoopStarted = false;
        
        window.checkCanPlay = function() {
            if (loadedCount >= 8 && window.turnstileSolved && !gameLoopStarted) {
                gameLoopStarted = true;
                playBtn.innerText = 'PLAY';
                playBtn.disabled = false;
                
                lastLogicTime = performance.now();
                setInterval(logicLoop, 1000 / 60);
                requestAnimationFrame(renderLoop);
            }
        };

        let loadedCount = 0;
        function onAssetLoad() {
            loadedCount++;
            window.checkCanPlay();
        }

        function setupAsset(img, src) {
            let counted = false;
            function count() {
                if (!counted) { counted = true; onAssetLoad(); }
            }
            img.onload = count;
            img.onerror = count;
            img.src = src;
            if (img.complete) count();
        }

        setupAsset(assets.tilesheet, 'assets/vertopia-tilesheet.png');
        setupAsset(assets.playerHead, 'assets/player-head.png');
        setupAsset(assets.leftHand, 'assets/player-lefthand.png');
        setupAsset(assets.rightHand, 'assets/player-righthand.png');
        setupAsset(assets.sprintParticle, 'assets/sprint-particle.png');
        setupAsset(assets.tree, 'assets/tree.png');
        setupAsset(assets.rock, 'assets/rock.png');
        setupAsset(assets.itemBackground, 'assets/item-background.png');

        playBtn.addEventListener('click', () => {
            let inputName = nameInput.value.trim();
            let baseName = inputName === "" ? "Vertopian" : inputName;
            
            let newName = baseName;
            let counter = 1;
            let nameExists = () => {
                for (let id in otherPlayers) {
                    if (otherPlayers[id].name === newName) return true;
                }
                return false;
            };
            while (nameExists()) {
                newName = baseName + "-" + counter;
                counter++;
            }
            player.name = newName;
            
            if (auth.currentUser && auth.currentUser.email === 'thekingofnetashoky@gmail.com') {
                player.isOwner = true;
            } else {
                player.isOwner = false;
            }
            
            allPlayers = [];
            allPlayers.push({ name: player.name });
            
            mainMenu.style.display = 'none';
            locationOverlay.style.display = 'flex';
            gameState = 'PREVIEW';
            
            selectedRegX = 0;
            selectedRegZ = 0;
            spawnGridX = 0;
            spawnGridZ = 0;
            previewX = MAP_CENTER * TILE_SIZE;
            previewZ = MAP_CENTER * TILE_SIZE;
            
            updateSpawnInfo();
            renderSpawnGrid();
            
            player.dead = false;
            player.health = 100;
            player.energy = 100;
            player.damageNegationTimer = 0;
            player.kbVx = 0;
            player.kbVy = 0;
            player.lastDamageTime = getServerTime();
        });

        const tooltip = document.getElementById('itemTooltip');
        const tooltipName = document.getElementById('tooltipName');
        const tooltipDesc = document.getElementById('tooltipDesc');
        let draggedItem = null;
        let dragSourceSlot = null;
        let activeDragGhost = null;

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0 && e.target.classList.contains('item-img')) {
                e.preventDefault();
                dragSourceSlot = e.target.parentNode;
                draggedItem = e.target;
                tooltip.style.display = 'none';

                activeDragGhost = draggedItem.cloneNode(true);
                activeDragGhost.style.position = 'fixed';
                activeDragGhost.style.pointerEvents = 'none';
                activeDragGhost.style.zIndex = '10000';
                activeDragGhost.style.width = '45px';
                activeDragGhost.style.height = '45px';
                activeDragGhost.style.left = (e.clientX - 22) + 'px';
                activeDragGhost.style.top = (e.clientY - 22) + 'px';
                document.body.appendChild(activeDragGhost);
                
                draggedItem.style.opacity = '0.2';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (activeDragGhost) {
                activeDragGhost.style.left = (e.clientX - 22) + 'px';
                activeDragGhost.style.top = (e.clientY - 22) + 'px';
            } else if (tooltip.style.display === 'block') {
                tooltip.style.left = (e.pageX + 15) + 'px';
                tooltip.style.top = (e.pageY + 15) + 'px';
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (draggedItem && activeDragGhost) {
                activeDragGhost.remove();
                activeDragGhost = null;
                draggedItem.style.opacity = '1.0';

                let dropTarget = document.elementFromPoint(e.clientX, e.clientY);
                if (dropTarget) {
                    let targetSlot = dropTarget.closest('.inventory-slot');
                    if (targetSlot) {
                        let isArmor = targetSlot.parentElement && targetSlot.parentElement.id === 'armorSlots';
                        let isOutput = targetSlot.id === 'outputSlot';
                        
                        if (isArmor || isOutput) {
                        } else {
                            let existingItem = targetSlot.querySelector('.item-img');
                            if (existingItem && existingItem !== draggedItem) {
                                dragSourceSlot.appendChild(existingItem);
                                targetSlot.appendChild(draggedItem);
                            } else {
                                targetSlot.appendChild(draggedItem);
                            }
                        }
                    } else if (dropTarget.id === 'gameCanvas' || dropTarget.id === 'uiLayer') {
                        let itemName = draggedItem.getAttribute('data-name').toLowerCase();
                        dropItem(itemName, player.x + player.width/2, player.y + player.height/2, player.angle);
                        draggedItem.remove();
                    }
                }
                draggedItem = null;
                dragSourceSlot = null;
            }
        });

        document.addEventListener('mouseover', (e) => {
            if (e.target.classList && e.target.classList.contains('item-img') && !activeDragGhost) {
                tooltipName.innerText = e.target.getAttribute('data-name');
                tooltipDesc.innerText = e.target.getAttribute('data-desc');
                tooltip.style.display = 'block';
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.classList && e.target.classList.contains('item-img')) {
                tooltip.style.display = 'none';
            }
        });
        document.addEventListener('contextmenu', (e) => {
            if (e.target.classList && e.target.classList.contains('item-img')) {
                e.preventDefault();
                let itemName = e.target.getAttribute('data-name').toLowerCase();
                dropItem(itemName, player.x + player.width/2, player.y + player.height/2, player.angle);
                e.target.remove();
                tooltip.style.display = 'none';
            }
        });
        
        document.getElementById('loginBtn').addEventListener('click', () => {
            if (auth.currentUser) {
                signOut(auth);
            } else {
                signInWithPopup(auth, googleProvider).catch(() => {});
            }
        });

        onAuthStateChanged(auth, (user) => {
            const loginText = document.querySelector('#loginBtn .login-text');
            if (user) {
                loginText.textContent = 'Logout';
                if (user.displayName && !nameInput.value.trim()) {
                    nameInput.value = user.displayName.substring(0, 15);
                }
            } else {
                loginText.textContent = 'Login';
            }
        });

        let currentPing = 0;
        setInterval(() => {
            if (gameState === 'PLAYING') {
                let start = performance.now();
                set(ref(db, `pings/${myPlayerId}`), start).then(() => {
                    currentPing = Math.round(performance.now() - start);
                    let pingEl = document.getElementById('pingValue');
                    if (pingEl) pingEl.innerText = currentPing;
                }).catch(() => {});
            }
        }, 2000);

        function update(dt) {
            let zoomLerp = Math.min(10 * dt, 1);
            currentZoom += (targetZoom - currentZoom) * zoomLerp; 

            if (gameState === 'MENU') {
                menuAngle += 0.08 * dt; 
            } else if (gameState === 'PLAYING' || gameState === 'DEAD') {
                
                player.equippedSlot = activeSlot;
                
                let hotbarSlots = document.querySelectorAll('#inventory .inventory-slot');
                if (hotbarSlots.length > player.equippedSlot) {
                    let activeSlotEl = hotbarSlots[player.equippedSlot];
                    let itemImg = activeSlotEl.querySelector('.item-img');
                    if (itemImg) {
                        player.inventory[player.equippedSlot] = itemImg.getAttribute('data-name').toLowerCase();
                    } else {
                        player.inventory[player.equippedSlot] = null;
                    }
                }
                
                for (let i = localDroppedItems.length - 1; i >= 0; i--) {
                    let item = localDroppedItems[i];
                    item.x += item.vx * dt;
                    item.y += item.vy * dt;
                    item.vx *= Math.pow(0.1, dt);
                    item.vy *= Math.pow(0.1, dt);
                    item.timer += dt;
                    
                    let dx = item.x - (player.x + player.width/2);
                    let dy = item.y - (player.y + player.height/2);
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (item.timer > 1.5 && dist < 40) {
                        if (pickupItem(item.type)) {
                            localDroppedItems.splice(i, 1);
                            continue;
                        }
                    } else if (Math.abs(item.vx) < 5 && Math.abs(item.vy) < 5 && item.timer > 0.5) {
                        push(droppedItemsRef, {
                            type: item.type,
                            x: item.x,
                            y: item.y,
                            rot: 0,
                            t: getServerTime()
                        });
                        localDroppedItems.splice(i, 1);
                    }
                }
                
                for (let key in globalDroppedItems) {
                    let item = globalDroppedItems[key];
                    let dx = item.x - (player.x + player.width/2);
                    let dy = item.y - (player.y + player.height/2);
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (getServerTime() - item.t > 1500 && dist < 40) {
                        if (pickupItem(item.type)) {
                            remove(ref(db, `droppedItems/${key}`));
                        }
                    }
                }

                if (player.damageNegationTimer > 0) player.damageNegationTimer -= dt;
                if (player.dead && player.deathTimer > 0) player.deathTimer -= dt;
                
                if (!player.dead) {
                    if (isRightMouseDown && player.swingTimer <= 0 && !player.isWater) {
                        player.isBlocking = true;
                    } else {
                        player.isBlocking = false;
                    }
                } else {
                    player.isBlocking = false;
                    player.sprintActive = false;
                    keys.w = keys.a = keys.s = keys.d = keys.shift = false;
                }

                if (Math.abs(player.kbVx) > 1 || Math.abs(player.kbVy) > 1) {
                    player.x += player.kbVx * dt;
                    player.y += player.kbVy * dt;
                    
                    let friction = Math.pow(0.02, dt); 
                    player.kbVx *= friction;
                    player.kbVy *= friction;
                } else {
                    player.kbVx = 0;
                    player.kbVy = 0;
                }

                if (player.isBlocking) {
                    player.blockAmount = Math.min(1.0, player.blockAmount + dt * 8.0);
                } else {
                    player.blockAmount = Math.max(0.0, player.blockAmount - dt * 8.0);
                }

                for (let id in otherPlayers) {
                    let op = otherPlayers[id];
                    if (op.blocking) {
                        op.blockAmount = Math.min(1.0, op.blockAmount + dt * 8.0);
                    } else {
                        op.blockAmount = Math.max(0.0, op.blockAmount - dt * 8.0);
                    }
                }

                if (isMouseDown && !player.isBlocking && !player.dead) {
                    attemptAttack();
                }

                for (let i = player.chatMessages.length - 1; i >= 0; i--) {
                    player.chatMessages[i].timer -= dt;
                    if (player.chatMessages[i].timer <= 0) {
                        player.chatMessages.splice(i, 1);
                    }
                }

                for (let id in otherPlayers) {
                    for (let i = otherPlayers[id].chatMessages.length - 1; i >= 0; i--) {
                        otherPlayers[id].chatMessages[i].timer -= dt;
                        if (otherPlayers[id].chatMessages[i].timer <= 0) {
                            otherPlayers[id].chatMessages.splice(i, 1);
                        }
                    }
                }

                let focusX = player.x + (player.width / 2) + cameraPanOffset.x;
                let focusY = player.y + (player.height / 2) + cameraPanOffset.y;
                if (gameState === 'DEAD' && player.killedBy && otherPlayers[player.killedBy]) {
                    focusX = otherPlayers[player.killedBy].x + player.width / 2;
                    focusY = otherPlayers[player.killedBy].y + player.height / 2;
                }

                const visibleWidth = width / currentZoom;
                const visibleHeight = height / currentZoom;
                const startCol = Math.floor((focusX - visibleWidth / 2) / TILE_SIZE) - 2;
                const endCol = Math.ceil((focusX + visibleWidth / 2) / TILE_SIZE) + 2;
                const startRow = Math.floor((focusY - visibleHeight / 2) / TILE_SIZE) - 2;
                const endRow = Math.ceil((focusY + visibleHeight / 2) / TILE_SIZE) + 2;

                for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                        let id = c + "_" + r;
                        if (trees.has(id)) {
                            let t = trees.get(id);
                            if (!t.dead || t.deathTimer > 0) {
                                if (!t.inView) {
                                    t.inView = true;
                                    activeTrees.add(t);
                                }
                            }
                        }
                    }
                }

                for (let t of activeTrees) {
                    if (t.hitTimer > 0) {
                        t.hitTimer -= dt;
                        if (t.hitTimer <= 0) t.hitTimer = 0;
                    }
                    if (t.dead && t.deathTimer > 0) {
                        t.deathTimer -= dt;
                        if (t.deathTimer <= 0) t.deathTimer = 0;
                    }
                    
                    let ptC = Math.floor(t.x / TILE_SIZE);
                    let ptR = Math.floor(t.y / TILE_SIZE);
                    let actuallyInView = (ptC >= startCol && ptC <= endCol && ptR >= startRow && ptR <= endRow);
                    
                    if (actuallyInView && !t.dead) {
                        t.inView = true;
                        if (t.visibleState < 1.0) {
                            t.visibleState += dt * 5.0; 
                            if (t.visibleState > 1.0) t.visibleState = 1.0;
                        }
                    } else {
                        t.inView = false;
                        if (t.visibleState > 0.0) {
                            t.visibleState -= dt * 5.0;
                            if (t.visibleState < 0.0) t.visibleState = 0.0;
                        }
                    }
                    
                    if (!t.inView && t.visibleState === 0 && t.deathTimer <= 0 && t.hitTimer <= 0) {
                        activeTrees.delete(t);
                    }
                }

                for (let i = particles.length - 1; i >= 0; i--) {
                    let p = particles[i];
                    p.life -= dt;
                    if (p.life <= 0) {
                        particles.splice(i, 1);
                    } else {
                        let ratio = p.life / p.maxLife;
                        if (p.isWater) {
                            p.alpha = ratio * 1.0; 
                            p.size = 24 + (1 - ratio) * 60;
                        } else {
                            p.alpha = ratio * 1.0;
                            p.size = ratio * 48;
                        }
                    }
                }

                if (player.cooldownTimer > 0) player.cooldownTimer -= dt;
                if (player.footstepTimer > 0) player.footstepTimer -= dt;

                if (player.swingTimer > 0) {
                    player.swingTimer += dt;
                    if (player.swingTimer >= player.swingDuration) {
                        player.nextHand = player.nextHand === 'right' ? 'left' : 'right'; 
                        player.swingTimer = 0; 
                    }
                }
                
                if (player.inventory && player.inventory[player.equippedSlot] === 'rock') {
                    player.nextHand = 'right';
                }

                let dx = 0;
                let dy = 0;
                if (!player.dead) {
                    if (keys.w) dy -= 1;
                    if (keys.s) dy += 1;
                    if (keys.a) dx -= 1;
                    if (keys.d) dx += 1;
                }

                if (dx !== 0 && dy !== 0) {
                    const length = Math.sqrt(dx * dx + dy * dy);
                    dx /= length;
                    dy /= length;
                }

                let isMoving = dx !== 0 || dy !== 0;

                if (keys.shift && isMoving && player.energy > 15 && !player.exhausted && !player.isBlocking) {
                    player.sprintActive = true;
                }
                if (!keys.shift || !isMoving || player.energy <= 0 || player.exhausted || player.isBlocking) {
                    player.sprintActive = false;
                }
                
                let tileX = Math.floor((player.x + player.width / 2) / TILE_SIZE);
                let tileY = Math.floor((player.y + player.height / 2) / TILE_SIZE);
                tileX = Math.max(0, Math.min(MAP_COLS - 1, tileX));
                tileY = Math.max(0, Math.min(MAP_ROWS - 1, tileY));
                let currentTile = mapData[tileY * MAP_COLS + tileX]; 
                let isWater = currentTile === 1;
                player.isWater = isWater;
                if (isWater) {
                    player.swimTransition = Math.min(1.0, (player.swimTransition || 0) + dt * 4.0);
                } else {
                    player.swimTransition = Math.max(0.0, (player.swimTransition || 0) - dt * 4.0);
                }

                if (isWater) { 
                    player.speed = player.sprintActive ? 96 : 64;
                } else {
                    player.speed = player.sprintActive ? 288 : 192;
                }

                if (player.isBlocking) {
                    player.speed *= 0.75;
                }

                if (player.sprintActive && !player.isBlocking) {
                    player.energy -= 20 * dt; 
                    player.regenDelay = Math.max(player.regenDelay, 1.5);
                    if (player.energy <= 0) {
                        player.energy = 0;
                        player.exhausted = true;
                        player.regenDelay = 5.0;
                    }
                }

                if (isWater || (player.sprintActive && isMoving)) {
                    player.particleTimer -= dt;
                    if (player.particleTimer <= 0) {
                        particles.push({
                            x: player.x + player.width / 2,
                            y: player.y + player.height / 2,
                            size: 48,
                            alpha: 1.0,
                            life: 0.6,
                            maxLife: 0.6,
                            isWater: isWater
                        });
                        player.particleTimer = isWater ? (player.sprintActive ? 0.4 : 0.75) : 0.2;
                    }
                }

                if (!player.dead && player.health < 100) {
                    if (getServerTime() - player.lastDamageTime > 15000) {
                        player.health += 5 * dt; 
                        if (player.health > 100) player.health = 100;
                    }
                }

                if (player.regenDelay > 0) {
                    player.regenDelay -= dt;
                    if (player.regenDelay <= 0) {
                        player.exhausted = false;
                    }
                } else {
                    if (!player.sprintActive && player.energy < 100) {
                        player.energy += 15 * dt; 
                        if (player.energy > 100) player.energy = 100;
                    }
                }

                energyFill.style.width = player.energy + '%';
                healthFill.style.width = player.health + '%';

                if (isMoving) {
                    let moveX = dx * player.speed * dt;
                    let moveY = dy * player.speed * dt;

                    player.x += moveX;
                    player.y += moveY;

                    if (player.footstepTimer <= 0) {
                        if (player.currentStepSound) {
                            try { player.currentStepSound.pause(); } catch(e) {}
                            player.currentStepSound = null;
                        }
                        if (isWater) { 
                            player.currentStepSound = playSoundInstance(assets.swimSounds, player.x + player.width / 2, player.y + player.height / 2);
                        } else if (currentTile === 2) { 
                            player.currentStepSound = playSoundInstance(assets.sandSteps, player.x + player.width / 2, player.y + player.height / 2);
                        } else { 
                            player.currentStepSound = playSoundInstance(assets.grassSteps, player.x + player.width / 2, player.y + player.height / 2);
                        }
                        player.footstepTimer = player.sprintActive ? 0.4 : 0.5; 
                    }
                } else {
                    if (player.currentStepSound) {
                        try { 
                            player.currentStepSound.pause();
                            player.currentStepSound.currentTime = 0;
                        } catch(e) {}
                        player.currentStepSound = null;
                    }
                }

                let r = player.width / 2;
                let cx = player.x + r;
                let cy = player.y + r;
                
                let pTileX = Math.floor(cx / TILE_SIZE);
                let pTileY = Math.floor(cy / TILE_SIZE);
                for (let tr = pTileY - 2; tr <= pTileY + 2; tr++) {
                    for (let tc = pTileX - 2; tc <= pTileX + 2; tc++) {
                        let id = tc + "_" + tr;
                        if (trees.has(id)) {
                            let t = trees.get(id);
                            if (t.hp > 0) {
                                let tRadius = 48 * (t.baseScale || 1.0);
                                let distX = cx - t.cx;
                                let distY = cy - t.cy;
                                let distance = Math.sqrt(distX*distX + distY*distY);
                                
                                if (distance < r + tRadius) {
                                    let overlap = (r + tRadius) - distance;
                                    if (distance === 0) {
                                        player.y -= overlap;
                                    } else {
                                        player.x += (distX / distance) * overlap;
                                        player.y += (distY / distance) * overlap;
                                    }
                                    cx = player.x + r;
                                    cy = player.y + r;
                                }
                            }
                        }
                    }
                }

                let minRadius = 40;
                for (let id in otherPlayers) {
                    let p = otherPlayers[id];
                    if (p.dead) continue;
                    let pcx = p.x + r;
                    let pcy = p.y + r;
                    
                    let pdx = cx - pcx;
                    let pdy = cy - pcy;
                    let dist = Math.sqrt(pdx*pdx + pdy*pdy);

                    if (dist < minRadius && dist > 0) {
                        let overlap = minRadius - dist;
                        let nx = pdx / dist;
                        let ny = pdy / dist;
                        
                        player.x += nx * overlap;
                        player.y += ny * overlap;
                        
                        cx = player.x + r;
                        cy = player.y + r;
                    }
                }

                for (let id in otherPlayers) {
                    let p = otherPlayers[id];
                    
                    if (p.dead && p.deathTimer > 0) {
                        p.deathTimer -= dt;
                    }

                    let lerpSpeed = 15 * dt;
                    if (p.x === undefined) p.x = p.targetX;
                    if (p.y === undefined) p.y = p.targetY;
                    if (p.angle === undefined) p.angle = p.targetAngle;

                    p.x += (p.targetX - p.x) * lerpSpeed;
                    p.y += (p.targetY - p.y) * lerpSpeed;

                    let diff = p.targetAngle - p.angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    p.angle += diff * lerpSpeed;

                    if (p.swingTimer > 0) {
                        p.swingTimer += dt;
                        if (p.swingTimer >= player.swingDuration) {
                            p.nextHand = p.nextHand === 'right' ? 'left' : 'right';
                            p.swingTimer = 0;
                        }
                    }

                    let distMoved = Math.sqrt((p.targetX - p.x)**2 + (p.targetY - p.y)**2);
                    let pIsMoving = distMoved > 2.0;
                    if (p.dead) pIsMoving = false;

                    if (p.footstepTimer > 0) p.footstepTimer -= dt;
                    if (p.particleTimer > 0) p.particleTimer -= dt;

                    let ptX = Math.floor((p.x + r) / TILE_SIZE);
                    let ptY = Math.floor((p.y + r) / TILE_SIZE);
                    ptX = Math.max(0, Math.min(MAP_COLS - 1, ptX));
                    ptY = Math.max(0, Math.min(MAP_ROWS - 1, ptY));
                    let ptTile = mapData[ptY * MAP_COLS + ptX];
                    let ptIsWater = ptTile === 1;
                    p.isWater = ptIsWater;
                    if (ptIsWater) {
                        p.swimTransition = Math.min(1.0, (p.swimTransition || 0) + dt * 4.0);
                    } else {
                        p.swimTransition = Math.max(0.0, (p.swimTransition || 0) - dt * 4.0);
                    }

                    if (pIsMoving) {
                        if (p.footstepTimer <= 0) {
                            if (p.currentStepSound) {
                                try { p.currentStepSound.pause(); } catch(e) {}
                            }
                            if (ptIsWater) p.currentStepSound = playSoundInstance(assets.swimSounds, p.x + r, p.y + r);
                            else if (ptTile === 2) p.currentStepSound = playSoundInstance(assets.sandSteps, p.x + r, p.y + r);
                            else p.currentStepSound = playSoundInstance(assets.grassSteps, p.x + r, p.y + r);
                            
                            p.footstepTimer = p.sprint ? 0.4 : 0.5;
                        }
                    }

                    if (ptIsWater || (p.sprint && pIsMoving)) {
                        if (p.particleTimer <= 0) {
                            particles.push({
                                x: p.x + r,
                                y: p.y + r,
                                size: 48,
                                alpha: 1.0,
                                life: 0.6,
                                maxLife: 0.6,
                                isWater: ptIsWater
                            });
                            p.particleTimer = ptIsWater ? (p.sprint ? 0.4 : 0.75) : 0.2;
                        }
                    }
                }

                const maxX = MAP_COLS * TILE_SIZE - player.width;
                const maxY = MAP_ROWS * TILE_SIZE - player.height;
                player.x = Math.max(0, Math.min(player.x, maxX));
                player.y = Math.max(0, Math.min(player.y, maxY));

                minCtx.clearRect(0, 0, 160, 160);
                let miniTileX = Math.floor((player.x + (player.width / 2)) / TILE_SIZE);
                let miniTileY = Math.floor((player.y + (player.height / 2)) / TILE_SIZE);
                
                let viewRadius = 8;
                for (let y = -viewRadius; y <= viewRadius; y++) {
                    for (let x = -viewRadius; x <= viewRadius; x++) {
                        let tx = miniTileX + x;
                        let ty = miniTileY + y;
                        if (tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS) {
                            let tileVal = mapData[ty * MAP_COLS + tx];
                            let srcX = (tileVal % 10) * TILE_SIZE;
                            let srcY = Math.floor(tileVal / 10) * TILE_SIZE;
                            minCtx.drawImage(assets.tilesheet, srcX, srcY, TILE_SIZE, TILE_SIZE, (x + viewRadius) * 10, (y + viewRadius) * 10, 10, 10);
                        }
                    }
                }
                
                minCtx.fillStyle = 'white';
                minCtx.beginPath();
                minCtx.arc(80, 80, 3, 0, Math.PI * 2);
                minCtx.fill();
                
                coordX.innerText = Math.floor(player.x / TILE_SIZE) - MAP_CENTER;
                coordZ.innerText = Math.floor(player.y / TILE_SIZE) - MAP_CENTER;

                let targetPanX = 0;
                let targetPanY = 0;
                
                if (gameState === 'PLAYING' && !player.dead) {
                    const panRatioX = (mouse.x - (width / 2)) / (width / 2);
                    const panRatioY = (mouse.y - (height / 2)) / (height / 2);
                    targetPanX = panRatioX * MAX_PAN;
                    targetPanY = panRatioY * MAX_PAN;
                }

                let panLerp = Math.min(5 * dt, 1);
                cameraPanOffset.x += (targetPanX - cameraPanOffset.x) * panLerp;
                cameraPanOffset.y += (targetPanY - cameraPanOffset.y) * panLerp;

                const screenPlayerX = (width / 2) - (cameraPanOffset.x * currentZoom);
                const screenPlayerY = (height / 2) - (cameraPanOffset.y * currentZoom);
                
                if (!player.dead) {
                    player.angle = Math.atan2(mouse.y - screenPlayerY, mouse.x - screenPlayerX);
                }

                let now = performance.now();
                if (now - lastSyncTime > 50) { 
                    if (isMoving || lastAngle !== player.angle || player.sprintActive !== false || player.forceSync || player.isBlocking || Math.abs(player.kbVx) > 1 || Math.abs(player.kbVy) > 1 || now - lastSyncTime > 3000) {
                        let syncData = {
                            x: Math.round(player.x),
                            y: Math.round(player.y),
                            angle: Number(player.angle.toFixed(2)),
                            name: player.name,
                            isOwner: player.isOwner || false,
                            sprint: player.sprintActive,
                            attack: player.attackCounter,
                            equippedItem: (player.inventory && player.inventory[player.equippedSlot]) ? player.inventory[player.equippedSlot] : null,
                            blocking: player.isBlocking,
                            health: player.health,
                            t: getServerTime()
                        };
                        if (player.chatPayload) {
                            syncData.chat = player.chatPayload;
                        }
                        
                        fbUpdate(myPlayerRef, syncData);
                        lastSyncTime = now;
                        lastAngle = player.angle;
                        player.forceSync = false;
                    }
                }
            }
        }

        function drawPreview() {
            const ui = document.getElementById('craftingUI');
            if (gameState !== 'PLAYING' || ui.style.display === 'none') return;
            
            const pCanvas = document.getElementById('previewCanvas');
            const pCtx = pCanvas.getContext('2d');
            
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            
            const centerX = pCanvas.width / 2;
            const centerY = pCanvas.height / 2;
            
            let dpr = window.devicePixelRatio || 1;
            const rect = pCanvas.getBoundingClientRect();
            const mouseX = mouse.x - (rect.left * dpr);
            const mouseY = mouse.y - (rect.top * dpr);
            
            const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
            
            pCtx.save();
            pCtx.translate(centerX, centerY);
            pCtx.rotate(angle);
            
            const baseHandX = 24; 
            const baseHandY = 24; 
            
            let idleOffset = 0;
            if (player.swingTimer <= 0) {
                idleOffset = Math.sin(performance.now() / 400) * 1.5;
            }
            
            pCtx.save();
            pCtx.translate(baseHandX + idleOffset, -baseHandY);
            pCtx.drawImage(assets.leftHand, -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize);
            pCtx.restore();

            pCtx.save();
            pCtx.translate(baseHandX + idleOffset, baseHandY);
            pCtx.drawImage(assets.rightHand, -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize);
            
            if (player.inventory && player.inventory[player.equippedSlot] === 'rock') {
                let rockSize = player.handSize * 1.4;
                pCtx.save();
                pCtx.rotate(Math.PI);
                pCtx.drawImage(assets.rock, -rockSize / 2, -rockSize / 2, rockSize, rockSize);
                pCtx.restore();
            }
            
            pCtx.restore();

            pCtx.save();
            pCtx.translate(idleOffset, 0);
            pCtx.drawImage(assets.playerHead, -player.width / 2, -player.height / 2, player.width, player.height);
            pCtx.restore();
            
            pCtx.restore();
        }

        function drawChatBubble(ctx, text, x, y, timer, maxTime = 4.0, stackIndex = 0) {
            if (timer <= 0) return;
            let alpha = 1.0;
            let slideY = 0;
            
            if (timer > maxTime - 0.2) {
                let progress = (maxTime - timer) / 0.2; 
                alpha = progress;
                slideY = (1 - progress) * 15; 
            } else if (timer < 0.5) {
                alpha = timer / 0.5;
            }
            
            ctx.save();
            ctx.globalAlpha = alpha;
            let yOffset = stackIndex * 38;
            ctx.translate(x, y + slideY - 45 - yOffset); 
            
            ctx.font = 'bold 15px "Segoe UI", sans-serif';
            let metrics = ctx.measureText(text);
            let tw = metrics.width;
            let th = 15;
            let padX = 12;
            let padY = 8;
            
            let bw = tw + padX * 2;
            let bh = th + padY * 2;
            let bx = -bw / 2;
            let by = -bh / 2;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(bx, by, bw, bh, 8);
            } else {
                ctx.rect(bx, by, bw, bh);
            }
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(-6, by + bh);
            ctx.lineTo(6, by + bh);
            ctx.lineTo(0, by + bh + 6);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 1);
            
            ctx.restore();
        }

        function draw() {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            let focusX = 0;
            let focusY = 0;

            if (gameState === 'PLAYING' || gameState === 'DEAD') {
                if (gameState === 'DEAD' && player.killedBy && otherPlayers[player.killedBy]) {
                    let killer = otherPlayers[player.killedBy];
                    focusX = killer.x + (player.width / 2);
                    focusY = killer.y + (player.height / 2);
                } else {
                    focusX = player.x + (player.width / 2) + cameraPanOffset.x;
                    focusY = player.y + (player.height / 2) + cameraPanOffset.y;
                }
            } else if (gameState === 'PREVIEW' || gameState === 'SPAWN_PICKER') {
                focusX = previewX;
                focusY = previewZ;
            } else {
                let radiusX = 800; 
                let radiusY = 800;
                focusX = (MAP_CENTER * TILE_SIZE) + Math.cos(menuAngle) * radiusX;
                focusY = (MAP_CENTER * TILE_SIZE) + Math.sin(menuAngle) * radiusY;
            }

            const visibleWidth = width / currentZoom;
            const visibleHeight = height / currentZoom;
            const startCol = Math.max(0, Math.floor((focusX - visibleWidth / 2) / TILE_SIZE) - 1);
            const endCol = Math.min(MAP_COLS - 1, Math.floor((focusX + visibleWidth / 2) / TILE_SIZE) + 1);
            const startRow = Math.max(0, Math.floor((focusY - visibleHeight / 2) / TILE_SIZE) - 1);
            const endRow = Math.min(MAP_ROWS - 1, Math.floor((focusY + visibleHeight / 2) / TILE_SIZE) + 1);

            for (let c = startCol; c <= endCol; c++) {
                for (let r = startRow; r <= endRow; r++) {
                    let tileType = mapData[r * MAP_COLS + c];
                    let sourceX = tileType * TILE_SIZE;

                    let screenX = Math.floor((c * TILE_SIZE - focusX) * currentZoom + width / 2);
                    let screenY = Math.floor((r * TILE_SIZE - focusY) * currentZoom + height / 2);
                    let nextScreenX = Math.floor(((c + 1) * TILE_SIZE - focusX) * currentZoom + width / 2);
                    let nextScreenY = Math.floor(((r + 1) * TILE_SIZE - focusY) * currentZoom + height / 2);
                    
                    let drawW = nextScreenX - screenX;
                    let drawH = nextScreenY - screenY;

                    ctx.drawImage(
                        assets.tilesheet,
                        sourceX, 0, TILE_SIZE, TILE_SIZE, 
                        screenX, screenY, drawW, drawH
                    );
                }
            }

            ctx.save();
            ctx.translate(Math.round(width / 2), Math.round(height / 2));
            ctx.scale(currentZoom, currentZoom);
            ctx.translate(-focusX, -focusY);


            if (gameState === 'PLAYING' || gameState === 'DEAD') {
                
                [...localDroppedItems, ...Object.values(globalDroppedItems)].forEach(item => {
                    if (assets[item.type]) {
                        ctx.save();
                        ctx.translate(item.x, item.y);
                        ctx.drawImage(assets.itemBackground, -20, -20, 40, 40);
                        ctx.rotate(item.rot);
                        ctx.drawImage(assets[item.type], -16, -16, 32, 32);
                        ctx.restore();
                    }
                });

                particles.forEach(p => {
                    if (p.isWater) {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.globalAlpha = p.alpha;
                        ctx.drawImage(assets.sprintParticle, -p.size/2, -p.size/2, p.size, p.size);
                        ctx.beginPath();
                        ctx.arc(0, 0, p.size/2 * 0.8, 0, Math.PI*2);
                        ctx.fillStyle = "rgba(0, 255, 255, " + (p.alpha * 0.4) + ")";
                        ctx.fill();
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "rgba(0, 255, 255, " + p.alpha + ")";
                        ctx.stroke();
                        ctx.restore();
                    } else {
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.globalAlpha = p.alpha;
                        ctx.drawImage(assets.sprintParticle, -p.size/2, -p.size/2, p.size, p.size);
                        ctx.restore();
                    }
                });

                for (let id in otherPlayers) {
                    let p = otherPlayers[id];
                    ctx.save();
                    ctx.translate(p.x + (player.width / 2), p.y + (player.height / 2));
                    
                    if (p.dead) {
                        let progress = 1.0 - (p.deathTimer / 0.15);
                        if (progress > 1.0) progress = 1.0;
                        ctx.globalAlpha = Math.max(0, 1.0 - progress);
                        let shrink = Math.max(0.01, 1.0 - progress);
                        ctx.scale(shrink, shrink);
                    }

                    let pHeadTilt = 0;
                    let pRightPunch = 0;
                    let pLeftPunch = 0;
                    let pRightInward = 0;
                    let pLeftInward = 0;
                    let pRightHandTilt = 0;
                    let pLeftHandTilt = 0;

                    if (p.swingTimer > 0) {
                        let progress = p.swingTimer / player.swingDuration;
                        let punchExtension = Math.sin(progress * Math.PI); 

                        if (p.nextHand === 'right') {
                            pRightPunch = punchExtension * 24; 
                            pRightInward = punchExtension * -10;    
                            pHeadTilt = punchExtension * -0.25;      
                            pRightHandTilt = punchExtension * -0.5; 
                        } else {
                            pLeftPunch = punchExtension * 24;
                            pLeftInward = punchExtension * 10;      
                            pHeadTilt = punchExtension * 0.25;     
                            pLeftHandTilt = punchExtension * 0.5;   
                        }
                    }
                    
                    let bAmt = p.blockAmount;
                    pRightPunch += 6 * bAmt;
                    pRightInward += -19 * bAmt;
                    pRightHandTilt += -0.8 * bAmt;
                    pLeftPunch += 6 * bAmt;
                    pLeftInward += 19 * bAmt;
                    pLeftHandTilt += 0.8 * bAmt;
                    
                    const baseHandX = 24; 
                    const baseHandY = 24; 
                    let timeDivisor = p.sprint ? 266 : 400;
                    let pIdleOffset = p.swingTimer <= 0 && bAmt === 0 ? Math.sin(performance.now() / timeDivisor) * 1.5 : 0;
                    
                    if (p.swimTransition > 0) {
                        let trans = p.swimTransition;
                        pRightInward += 7 * trans;
                        pLeftInward -= 7 * trans;
                        let swimCycle = Math.sin(performance.now() / timeDivisor);
                        
                        pRightPunch += -swimCycle * 6 * trans;
                        pLeftPunch += -swimCycle * 6 * trans;
                        
                        pRightInward += swimCycle * 4 * trans;
                        pLeftInward -= swimCycle * 4 * trans;
                        
                        pRightHandTilt += swimCycle * 0.4 * trans;
                        pLeftHandTilt -= swimCycle * 0.4 * trans;
                    }

                    ctx.save();
                    ctx.rotate(p.angle);
                    ctx.translate(baseHandX + pLeftPunch + pIdleOffset, -baseHandY + pLeftInward);
                    ctx.rotate(pLeftHandTilt);
                    ctx.drawImage(
                        assets.leftHand,
                        -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize
                    );
                    ctx.restore();

                    ctx.save();
                    ctx.rotate(p.angle);
                    ctx.translate(baseHandX + pRightPunch + pIdleOffset, baseHandY + pRightInward);
                    ctx.rotate(pRightHandTilt);
                    ctx.drawImage(
                        assets.rightHand,
                        -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize
                    );
                    
                    if (p.equippedItem === 'rock') {
                        let rockSize = player.handSize * 1.4;
                        ctx.save();
                        ctx.rotate(Math.PI);
                        ctx.drawImage(assets.rock, -rockSize / 2, -rockSize / 2, rockSize, rockSize);
                        ctx.restore();
                    }
                    ctx.restore();

                    ctx.save();
                    ctx.rotate(p.angle + pHeadTilt);
                    ctx.translate(pIdleOffset, 0);
                    ctx.drawImage(
                        assets.playerHead,
                        -player.width / 2, -player.height / 2, player.width, player.height
                    );
                    ctx.restore();
                    ctx.restore();
                    
                    if (!p.dead) {
                        ctx.font = 'bold 15px "Segoe UI", sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = p.isOwner ? '#FFD700' : 'white';
                        ctx.fillText(p.name, p.x + (player.width / 2), p.y + player.height + 25);
                        
                        if (p.chatMessages) {
                            for (let i = p.chatMessages.length - 1; i >= 0; i--) {
                                let msgObj = p.chatMessages[i];
                                let stackIndex = p.chatMessages.length - 1 - i; 
                                drawChatBubble(ctx, msgObj.msg, p.x + (player.width / 2), p.y, msgObj.timer, msgObj.maxTime, stackIndex);
                            }
                        }
                    }
                }

                ctx.save();
                ctx.translate(player.x + (player.width / 2), player.y + (player.height / 2));
                
                if (player.dead) {
                    let progress = 1.0 - (player.deathTimer / 0.15);
                    if (progress > 1.0) progress = 1.0;
                    ctx.globalAlpha = Math.max(0, 1.0 - progress);
                    let shrink = Math.max(0.01, 1.0 - progress);
                    ctx.scale(shrink, shrink);
                }

                let headTilt = 0;
                let rightPunch = 0;
                let leftPunch = 0;
                let rightInward = 0;
                let leftInward = 0;
                let rightHandTilt = 0;
                let leftHandTilt = 0;

                if (player.swingTimer > 0) {
                    let progress = player.swingTimer / player.swingDuration;
                    let punchExtension = Math.sin(progress * Math.PI); 

                    if (player.nextHand === 'right') {
                        rightPunch = punchExtension * 24; 
                        rightInward = punchExtension * -10;    
                        headTilt = punchExtension * -0.25;      
                        rightHandTilt = punchExtension * -0.5; 
                    } else {
                        leftPunch = punchExtension * 24;
                        leftInward = punchExtension * 10;      
                        headTilt = punchExtension * 0.25;     
                        leftHandTilt = punchExtension * 0.5;   
                    }
                }

                let bAmt = player.blockAmount;
                rightPunch += 6 * bAmt;
                rightInward += -19 * bAmt;
                rightHandTilt += -0.8 * bAmt;
                leftPunch += 6 * bAmt;
                leftInward += 19 * bAmt;
                leftHandTilt += 0.8 * bAmt;

                const baseHandX = 24; 
                const baseHandY = 24; 
                let timeDivisor = player.sprintActive ? 266 : 400;
                let idleOffset = player.swingTimer <= 0 && bAmt === 0 ? Math.sin(performance.now() / timeDivisor) * 1.5 : 0;
                
                if (player.swimTransition > 0) {
                    let trans = player.swimTransition;
                    rightInward += 7 * trans;
                    leftInward -= 7 * trans;
                    
                    let swimCycle = Math.sin(performance.now() / timeDivisor);
                    
                    rightPunch += -swimCycle * 6 * trans;
                    leftPunch += -swimCycle * 6 * trans;
                    
                    rightInward += swimCycle * 4 * trans;
                    leftInward -= swimCycle * 4 * trans;
                    
                    rightHandTilt += swimCycle * 0.4 * trans;
                    leftHandTilt -= swimCycle * 0.4 * trans;
                }

                ctx.save();
                ctx.rotate(player.angle);
                ctx.translate(baseHandX + leftPunch + idleOffset, -baseHandY + leftInward); 
                ctx.rotate(leftHandTilt); 
                ctx.drawImage(
                    assets.leftHand,
                    -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize
                );
                ctx.restore();

                ctx.save();
                ctx.rotate(player.angle);
                ctx.translate(baseHandX + rightPunch + idleOffset, baseHandY + rightInward); 
                ctx.rotate(rightHandTilt); 
                ctx.drawImage(
                    assets.rightHand,
                    -player.handSize / 2, -player.handSize / 2, player.handSize, player.handSize
                );
                
                if (player.inventory && player.inventory[player.equippedSlot] === 'rock') {
                    let rockSize = player.handSize * 1.4;
                    ctx.save();
                    ctx.rotate(Math.PI);
                    ctx.drawImage(assets.rock, -rockSize / 2, -rockSize / 2, rockSize, rockSize);
                    ctx.restore();
                }
                ctx.restore();

                ctx.save();
                ctx.rotate(player.angle + headTilt); 
                ctx.translate(idleOffset, 0);
                ctx.drawImage(
                    assets.playerHead,
                    -player.width / 2, -player.height / 2, player.width, player.height
                );
                ctx.restore();
                
                ctx.restore(); 

                if (!player.dead) {
                    ctx.font = 'bold 15px "Segoe UI", sans-serif';
                    ctx.textAlign = 'center';
                    
                    const textX = player.x + (player.width / 2);
                    const textY = player.y + player.height + 25;
                    
                    ctx.fillStyle = player.isOwner ? '#FFD700' : 'white';
                    ctx.fillText(player.name, textX, textY);
                    
                    if (player.chatMessages) {
                        for (let i = player.chatMessages.length - 1; i >= 0; i--) {
                            let msgObj = player.chatMessages[i];
                            let stackIndex = player.chatMessages.length - 1 - i; 
                            drawChatBubble(ctx, msgObj.msg, textX, player.y, msgObj.timer, msgObj.maxTime, stackIndex);
                        }
                    }
                }
            }

            for (let t of activeTrees) {
                if (t.visibleState > 0 || t.deathTimer > 0) {
                    ctx.save();
                    let drawX = t.cx;
                    let drawY = t.cy;
                    
                    if (t.hitTimer > 0) {
                        let bounceDist = Math.sin((t.hitTimer / 0.2) * Math.PI) * 12;
                        drawX += Math.cos(t.hitAngle) * bounceDist;
                        drawY += Math.sin(t.hitAngle) * bounceDist;
                    }
                    
                    ctx.translate(drawX, drawY);
                    
                    let scale = 1.0;
                    let alpha = 1.0;
                    
                    if (t.dead) {
                        let progress = 1.0 - (t.deathTimer / 0.5);
                        scale = t.visibleState + progress * 0.5;
                        alpha = (1.0 - progress) * t.visibleState;
                    } else {
                        scale = t.visibleState;
                        alpha = t.visibleState;
                    }
                    
                    scale *= (t.baseScale || 1.0);
                    
                    ctx.scale(scale, scale);
                    if (t.rot !== undefined) ctx.rotate(t.rot);
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(assets.tree, -64, -64, 128, 128);
                    ctx.restore();
                }
            }

            ctx.restore();
        }

        let lastLogicTime = 0;

        function logicLoop() {
            let now = performance.now();
            let dt = (now - lastLogicTime) / 1000;
            lastLogicTime = now;

            if (dt > 2.0) dt = 2.0;

            while (dt > 0) {
                let step = Math.min(dt, 0.05); 
                update(step);
                dt -= step;
            }
        }

        let frames = 0;
        let lastFpsTime = performance.now();
        let currentFps = 0;

        function renderLoop() {
            frames++;
            let now = performance.now();
            if (now - lastFpsTime >= 1000) {
                currentFps = frames;
                frames = 0;
                lastFpsTime = now;
                let fpsEl = document.getElementById('fpsValue');
                if (fpsEl) fpsEl.innerText = currentFps;
            }
            
            draw();
            drawPreview();
            requestAnimationFrame(renderLoop);
        }

        const craftBtnContainer = document.getElementById('craftBtnContainer');
        craftBtnContainer.addEventListener('click', () => {
            if (gameState === 'PLAYING') {
                let ui = document.getElementById('craftingUI');
                ui.style.display = (ui.style.display === 'none' || ui.style.display === '') ? 'flex' : 'none';
            }
        });

        const homeBtnContainer = document.getElementById('homeBtnContainer');
        homeBtnContainer.addEventListener('click', () => {
            if (gameState === 'PLAYING' && !player.dead) {
                player.health = 0;
                player.dead = true;
                player.deathTimer = 0.15;
                player.killedBy = 'self';
                player.forceSync = true;
                
                gameState = 'DEAD';
                document.getElementById('mainMenu').style.display = 'flex';
                document.getElementById('inventory').style.display = 'none';
                document.getElementById('leaderboardContainer').style.display = 'none';
                document.getElementById('minimapContainer').style.display = 'none';
                document.getElementById('statsContainer').style.display = 'none';
                document.getElementById('coordsContainer').style.display = 'none';
                document.getElementById('perfContainer').style.display = 'none';
                document.getElementById('craftBtnContainer').style.display = 'none';
                document.getElementById('homeBtnContainer').style.display = 'none';
                document.getElementById('craftingUI').style.display = 'none';
                document.getElementById('chatInputContainer').style.display = 'none';
            }
        });
