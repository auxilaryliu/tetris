'use client';

import { useEffect, useRef, useState } from 'react';

// === CONFIG ===
const COLS = 12;
const ROWS = 20;
const BLOCK_SIZE = 20;

// DAS / ARR tuning
const DAS = 150; // ms before repeat
const ARR = 30;  // ms per repeat

const COLORS = [
  '#000',
  '#F7A8B8', // pink
  '#A8DADC', // mint
  '#FFD6A5', // peach
  '#BDB2FF', // lavender
  '#CDB4DB', // mauve
  '#CAFFBF', // light green
  '#BEE7E8', // baby blue
];

const SHAPES: Record<string, number[][]> = {
  T: [
    [0, 0, 0],
    [1, 1, 1],
    [0, 1, 0],
  ],
  O: [
    [2, 2],
    [2, 2],
  ],
  L: [
    [0, 3, 0],
    [0, 3, 0],
    [0, 3, 3],
  ],
  J: [
    [0, 4, 0],
    [0, 4, 0],
    [4, 4, 0],
  ],
  I: [
    [0, 5, 0, 0],
    [0, 5, 0, 0],
    [0, 5, 0, 0],
    [0, 5, 0, 0],
  ],
  S: [
    [0, 6, 6],
    [6, 6, 0],
    [0, 0, 0],
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
};

function randomPiece() {
  const keys = Object.keys(SHAPES);
  return SHAPES[keys[(Math.random() * keys.length) | 0]];
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('cozy-tetris-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('cozy-tetris-highscore', highScore.toString());
  }, [highScore]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

    const previewCanvas = previewRef.current!;
    const pctx = previewCanvas.getContext('2d')!;
    pctx.scale(20, 20);

    const arena = createMatrix(COLS, ROWS);

    let nextPiece = randomPiece();

    const player = {
      pos: { x: 0, y: 0 },
      matrix: randomPiece(),
    };

    const input = {
      left: false,
      right: false,
      lastMoveTime: 0,
      holdStart: 0,
      direction: 0,
    };

    function createMatrix(w: number, h: number) {
      const m = [];
      while (h--) m.push(new Array(w).fill(0));
      return m;
    }

    function collide(matrix = player.matrix, pos = player.pos) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
          if (
            matrix[y][x] !== 0 &&
            (arena[y + pos.y] && arena[y + pos.y][x + pos.x]) !== 0
          ) return true;
        }
      }
      return false;
    }

    function merge() {
      player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
      });
    }

    function rotate(matrix: number[][]) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < y; x++) {
          [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
      }
      matrix.forEach(row => row.reverse());
    }

    function rotateWithKick() {
      const posX = player.pos.x;
      let offset = 1;
      rotate(player.matrix);

      while (collide()) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));

        if (Math.abs(offset) > player.matrix[0].length) {
          // undo rotation if all kicks fail
          rotate(player.matrix);
          rotate(player.matrix);
          rotate(player.matrix);
          player.pos.x = posX;
          return;
        }
      }
    }

    function resetPlayer() {
      player.matrix = nextPiece;
      nextPiece = randomPiece();
      drawPreview();

      player.pos.y = 0;
      player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);

      if (collide()) {
        arena.forEach(row => row.fill(0));
        setScore(0);
        setLines(0);
        setLevel(1);
      }
    }

    function sweep() {
      let rowCount = 0;
      outer: for (let y = arena.length - 1; y > 0; y--) {
        for (let x = 0; x < arena[y].length; x++) {
          if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        y++;
        rowCount++;
      }

      if (rowCount > 0) {
        const points = [0, 100, 300, 500, 800];
        const gained = points[rowCount] * level;

        setScore(s => {
          const newScore = s + gained;
          setHighScore(hs => Math.max(hs, newScore));
          return newScore;
        });

        setLines(l => {
          const newLines = l + rowCount;
          const newLevel = Math.floor(newLines / 10) + 1;
          setLevel(newLevel);
          dropInterval = Math.max(80, 220 - (newLevel - 1) * 20);
          return newLines;
        });
      }
    }

    function drawRoundedBlock(x: number, y: number, color: string, alpha = 1) {
      const r = 0.15;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 0.4;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + 1 - r, y);
      ctx.quadraticCurveTo(x + 1, y, x + 1, y + r);
      ctx.lineTo(x + 1, y + 1 - r);
      ctx.quadraticCurveTo(x + 1, y + 1, x + 1 - r, y + 1);
      ctx.lineTo(x + r, y + 1);
      ctx.quadraticCurveTo(x, y + 1, x, y + 1 - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawMatrix(matrix: number[][], offset: { x: number; y: number }, ghost = false) {
      matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            drawRoundedBlock(x + offset.x, y + offset.y, COLORS[value], ghost ? 0.25 : 1);
          }
        });
      });
    }

    function getGhostPosition() {
      const ghostPos = { ...player.pos };
      while (!collide(player.matrix, ghostPos)) ghostPos.y++;
      ghostPos.y--;
      return ghostPos;
    }

    function drawPreview() {
      pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      nextPiece.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            pctx.fillStyle = COLORS[value];
            pctx.fillRect(x, y, 1, 1);
          }
        });
      });
    }

    function draw() {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawMatrix(arena, { x: 0, y: 0 });

      const ghostPos = getGhostPosition();
      drawMatrix(player.matrix, ghostPos, true);
      drawMatrix(player.matrix, player.pos);
    }

    let dropCounter = 0;
    let dropInterval = 220;
    let lastTime = 0;

    function handleHorizontalInput(time: number) {
      if (!input.left && !input.right) return;

      const dir = input.direction;
      const elapsed = time - input.holdStart;

      if (elapsed < DAS) return;

      if (time - input.lastMoveTime > ARR) {
        move(dir);
        input.lastMoveTime = time;
      }
    }

    function update(time = 0) {
      const deltaTime = time - lastTime;
      lastTime = time;
      dropCounter += deltaTime;

      handleHorizontalInput(time);

      if (dropCounter > dropInterval) {
        player.pos.y++;
        if (collide()) {
          player.pos.y--;
          merge();
          sweep();
          resetPlayer();
        }
        dropCounter = 0;
      }

      draw();
      requestAnimationFrame(update);
    }

    function move(dir: number) {
      player.pos.x += dir;
      if (collide()) player.pos.x -= dir;
    }

    function drop() {
      player.pos.y++;
      if (collide()) {
        player.pos.y--;
        merge();
        sweep();
        resetPlayer();
      }
      dropCounter = 0;
    }

    function hardDrop() {
      while (!collide()) player.pos.y++;
      player.pos.y--;
      merge();
      sweep();
      resetPlayer();
      dropCounter = 0;
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') {
        if (!input.left) {
          input.left = true;
          input.right = false;
          input.direction = -1;
          input.holdStart = performance.now();
          input.lastMoveTime = 0;
          move(-1);
        }
      }
      if (e.key === 'ArrowRight') {
        if (!input.right) {
          input.right = true;
          input.left = false;
          input.direction = 1;
          input.holdStart = performance.now();
          input.lastMoveTime = 0;
          move(1);
        }
      }
      if (e.key === 'ArrowDown') drop();
      if (e.key === 'ArrowUp') rotateWithKick();
      if (e.key === ' ') hardDrop();
    });

    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft') input.left = false;
      if (e.key === 'ArrowRight') input.right = false;
    });

    resetPlayer();
    drawPreview();
    update();
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#1e1b2e] to-[#0f0c1d] text-white">
      <h1 className="text-4xl font-bold mb-3">Cozy Tetris</h1>

      <div className="mb-3 flex gap-6 text-sm bg-white/10 px-6 py-3 rounded-xl shadow">
        <div>Score: <span className="font-bold">{score}</span></div>
        <div>High: <span className="font-bold">{highScore}</span></div>
        <div>Lines: <span className="font-bold">{lines}</span></div>
        <div>Level: <span className="font-bold">{level}</span></div>
      </div>

      <div className="flex gap-6">
        <div className="p-4 rounded-2xl bg-white/10 backdrop-blur shadow-xl">
          <canvas
            ref={canvasRef}
            width={COLS * BLOCK_SIZE}
            height={ROWS * BLOCK_SIZE}
            className="rounded-xl"
          />
        </div>

        <div className="flex flex-col items-center gap-2 invisible w-0 overflow-hidden">
          <div className="text-sm opacity-70">Next</div>
          <canvas ref={previewRef} width={80} height={80} className="bg-white/10 rounded-lg" />
        </div>
      </div>

      <p className="mt-4 opacity-70 text-sm">
        ← → move • ↑ rotate • ↓ soft drop • space = hard drop
      </p>
    </main>
  );
}
