import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Tile {
    id: number;
    value: number;
    x: number;
    y: number;
    mergedFrom?: number[];
    isNew?: boolean;
}

const GRID_SIZE = 4;
const INITIAL_TILES = 2;

const Game2048: React.FC = () => {
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);
    const nextIdRef = useRef(0);

    // Initialize/Restart Game
    const initGame = useCallback(() => {
        nextIdRef.current = 0;
        setScore(0);
        setGameOver(false);
        setWon(false);
        
        let initialTiles: Tile[] = [];
        for (let i = 0; i < INITIAL_TILES; i++) {
            initialTiles = addTile(initialTiles);
        }
        setTiles(initialTiles);
    }, []);

    const addTile = (currentTiles: Tile[]): Tile[] => {
        const emptyPositions = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (!currentTiles.find(t => t.x === x && t.y === y)) {
                    emptyPositions.push({ x, y });
                }
            }
        }

        if (emptyPositions.length === 0) return currentTiles;

        const { x, y } = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const newTile: Tile = {
            id: nextIdRef.current++,
            value,
            x,
            y,
            isNew: true
        };

        return [...currentTiles, newTile];
    };

    useEffect(() => {
        const savedBest = localStorage.getItem('2048-best-score');
        if (savedBest) setBestScore(parseInt(savedBest));
        initGame();
    }, [initGame]);

    useEffect(() => {
        if (score > bestScore) {
            setBestScore(score);
            localStorage.setItem('2048-best-score', score.toString());
        }
    }, [score, bestScore]);

    const move = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
        if (gameOver) return;

        setTiles(prevTiles => {
            let currentTiles = prevTiles.map(t => ({ ...t, isNew: false, mergedFrom: undefined }));
            let moved = false;
            let newScore = score;

            const isVertical = direction === 'UP' || direction === 'DOWN';
            const isForward = direction === 'RIGHT' || direction === 'DOWN';

            // Sort tiles to process them in the right order
            currentTiles.sort((a, b) => {
                if (isVertical) {
                    return isForward ? b.y - a.y : a.y - b.y;
                }
                return isForward ? b.x - a.x : a.x - b.x;
            });

            const nextTiles: Tile[] = [];
            const mergedIds = new Set<number>();

            for (const tile of currentTiles) {
                let { x, y } = tile;
                let nextX = x;
                let nextY = y;

                // Find the furthest possible position
                while (true) {
                    let testX = nextX + (direction === 'LEFT' ? -1 : direction === 'RIGHT' ? 1 : 0);
                    let testY = nextY + (direction === 'UP' ? -1 : direction === 'DOWN' ? 1 : 0);

                    if (testX < 0 || testX >= GRID_SIZE || testY < 0 || testY >= GRID_SIZE) break;

                    const blockingTile = nextTiles.find(t => t.x === testX && t.y === testY);
                    if (blockingTile) {
                        if (blockingTile.value === tile.value && !mergedIds.has(blockingTile.id)) {
                            // Merge
                            nextX = testX;
                            nextY = testY;
                        }
                        break;
                    }

                    nextX = testX;
                    nextY = testY;
                }

                const mergeTarget = nextTiles.find(t => t.x === nextX && t.y === nextY);
                if (mergeTarget && mergeTarget.value === tile.value && !mergedIds.has(mergeTarget.id)) {
                    // Perform Merge
                    mergeTarget.value *= 2;
                    mergeTarget.mergedFrom = [mergeTarget.id, tile.id];
                    mergedIds.add(mergeTarget.id);
                    newScore += mergeTarget.value;
                    if (mergeTarget.value === 2048) setWon(true);
                    moved = true;
                } else {
                    if (nextX !== x || nextY !== y) moved = true;
                    nextTiles.push({ ...tile, x: nextX, y: nextY });
                }
            }

            if (moved) {
                setScore(newScore);
                const finalTiles = addTile(nextTiles);
                if (checkGameOver(finalTiles)) setGameOver(true);
                return finalTiles;
            }

            return prevTiles;
        });
    };

    const checkGameOver = (currentTiles: Tile[]) => {
        if (currentTiles.length < GRID_SIZE * GRID_SIZE) return false;

        for (const tile of currentTiles) {
            const neighbors = [
                { x: tile.x + 1, y: tile.y },
                { x: tile.x - 1, y: tile.y },
                { x: tile.x, y: tile.y + 1 },
                { x: tile.x, y: tile.y - 1 },
            ];

            for (const n of neighbors) {
                const neighborTile = currentTiles.find(t => t.x === n.x && t.y === n.y);
                if (neighborTile && neighborTile.value === tile.value) return false;
            }
        }
        return true;
    };

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    move('UP');
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    move('DOWN');
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    move('LEFT');
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    move('RIGHT');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [move]);

    // Touch Listeners
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;

        const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
        const deltaY = e.changedTouches[0].clientY - touchStart.current.y;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > 30) {
                move(deltaX > 0 ? 'RIGHT' : 'LEFT');
            }
        } else {
            if (Math.abs(deltaY) > 30) {
                move(deltaY > 0 ? 'DOWN' : 'UP');
            }
        }
        touchStart.current = null;
    };

    const getTileColor = (value: number) => {
        const colors: Record<number, string> = {
            2: 'bg-gray-100 text-gray-800',
            4: 'bg-gray-200 text-gray-800',
            8: 'bg-orange-200 text-orange-900',
            16: 'bg-orange-300 text-orange-900',
            32: 'bg-orange-400 text-white',
            64: 'bg-orange-500 text-white',
            128: 'bg-yellow-300 text-white shadow-[0_0_10px_rgba(253,224,71,0.5)]',
            256: 'bg-yellow-400 text-white shadow-[0_0_15px_rgba(250,204,21,0.6)]',
            512: 'bg-yellow-500 text-white shadow-[0_0_20px_rgba(234,179,8,0.7)]',
            1024: 'bg-yellow-600 text-white shadow-[0_0_25px_rgba(202,138,4,0.8)]',
            2048: 'bg-yellow-700 text-white shadow-[0_0_30px_rgba(161,98,7,0.9)] animate-pulse',
        };
        return colors[value] || 'bg-gray-800 text-white';
    };

    return (
        <div className="flex flex-col items-center select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="w-full max-w-[400px] flex justify-between items-center mb-6 px-2">
                <div className="flex flex-col">
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">2048</h1>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Spendigo Edition</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 p-2 rounded-xl min-w-[80px] text-center">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Score</div>
                        <div className="text-xl font-bold text-white leading-none">{score}</div>
                    </div>
                    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 p-2 rounded-xl min-w-[80px] text-center">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Best</div>
                        <div className="text-xl font-bold text-white leading-none">{bestScore}</div>
                    </div>
                </div>
            </div>

            <div className="relative bg-gray-800/50 backdrop-blur-md p-3 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden touch-none">
                {/* Grid Background */}
                <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-900/50 rounded-lg border border-gray-800"></div>
                    ))}
                </div>

                {/* Tiles Layer */}
                <div className="absolute inset-0 p-3">
                    {tiles.map((tile) => (
                        <div
                            key={tile.id}
                            className={`absolute w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-2xl sm:text-3xl font-black rounded-lg transition-all duration-150 ease-in-out
                                ${getTileColor(tile.value)}
                                ${tile.isNew ? 'animate-scale-in' : ''}
                                ${tile.mergedFrom ? 'animate-pop' : ''}
                            `}
                            style={{
                                transform: `translate(${tile.x * (window.innerWidth < 640 ? 76 : 92)}px, ${tile.y * (window.innerWidth < 640 ? 76 : 92)}px)`
                            }}
                        >
                            {tile.value}
                        </div>
                    ))}
                </div>

                {/* Overlays */}
                {(gameOver || won) && (
                    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-10 animate-fade-in">
                        <h2 className="text-4xl font-black text-white mb-4 italic">
                            {won ? 'YOU WIN!' : 'GAME OVER'}
                        </h2>
                        <button
                            onClick={initGame}
                            className="px-8 py-3 bg-white text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-transform uppercase tracking-widest"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
                <button
                    onClick={initGame}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg border border-gray-700 transition-colors uppercase text-xs tracking-widest"
                >
                    Restart Game
                </button>
                <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em]">Use arrows or swipe to move tiles</p>
            </div>

            <style>{`
                @keyframes scale-in {
                    0% { transform: scale(0); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes pop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1); }
                }
                @keyframes fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-scale-in { animation: scale-in 0.2s ease-out; }
                .animate-pop { animation: pop 0.15s ease-in-out; }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}</style>
        </div>
    );
};

export default Game2048;
