import "./style.css";
import { loop } from "uloop";

// TODO: dodge really big pieces of bread by flying

const lerp = (a: number, b: number, t: number) => a + t * (b - a);

class Entity {
  constructor(readonly game: Game) {}
  update() {}
  draw(t: number) {}
  reset() {}
}

class Duck extends Entity {
  ducking = false;

  constructor(game: Game) {
    super(game);
  }

  override update() {
    if (this.game.keys.ArrowDown) this.ducking = true;
    else this.ducking = false;
  }
  override draw() {
    const ctx = this.game.ctx;
    const asset = this.game.assets.duck;
    ctx.save();
    const t = Math.sin(Date.now() / 250) * 5;
    const offset = this.ducking ? asset.size.h / 2.5 : -asset.size.h / 2 + t;
    asset.draw(ctx, 50, this.game.height() - asset.size.h + offset, 2);
    ctx.restore();
  }
  override reset() {}
}

class Seagull extends Entity {
  pos = { prev: this.game.width(), current: this.game.width() };
  speed = 15;
  override update() {
    this.pos.prev = this.pos.current;
    this.pos.current -= this.speed;
    if (this.pos.current < -this.game.assets.seagull.size.w) {
      this.pos.current = this.game.width() + this.game.assets.seagull.size.w;
      this.pos.prev = this.pos.current;
    }
  }
  override draw(t: number): void {
    const ctx = this.game.ctx;
    const asset = this.game.assets.seagull;
    ctx.save();
    const position = lerp(this.pos.prev, this.pos.current, t);
    asset.draw(ctx, position, this.game.height() - this.game.height() / 2.5, 1.6);
    ctx.restore();
  }
}

function loadImage(src: string): HTMLImageElement {
  const image = document.createElement("img")!;
  image.src = src;
  return image;
}

function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, scale: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale);
}

interface AnimationDescriptor {
  /** Frame width */
  fw: number;
  /** Frame height */
  fh: number;
  /** Frame delay in ms */
  delay: number;
}
type AnimationFrame = { sx: number; sy: number; sw: number; sh: number };
class Animation {
  sheet: HTMLImageElement;
  current: number = 0;
  frames: AnimationFrame[] = [];
  size: { w: number; h: number };
  delay: number;
  lastFrame: number = Date.now();
  loaded = false;
  constructor(src: string, desc: AnimationDescriptor) {
    this.sheet = loadImage(src);
    this.size = { w: desc.fw, h: desc.fh };
    this.delay = desc.delay;

    this.sheet.onload = () => {
      const cols = this.sheet.naturalWidth / desc.fw;
      const rows = this.sheet.naturalHeight / desc.fh;
      for (let row = 0; row < rows; ++row) {
        for (let col = 0; col < cols; ++col) {
          const sx = col * desc.fw;
          const sy = row * desc.fh;
          const sw = desc.fw;
          const sh = desc.fh;
          this.frames.push({ sx, sy, sw, sh });
        }
      }
      this.loaded = true;
    };
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1) {
    if (!this.loaded) return;
    const now = Date.now();
    if (now - this.lastFrame > this.delay) {
      this.lastFrame = now;
      this.current = (this.current + 1) % this.frames.length;
    }

    const frame = this.frames[this.current];
    ctx.save();
    ctx.translate(x, y);
    const [w, h] = [this.size.w * scale, this.size.h * scale];
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sheet, frame.sx, frame.sy, frame.sw, frame.sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

class Game {
  entities: Entity[] = [];
  ctx: CanvasRenderingContext2D;
  keys: Record<string, boolean> = {};
  assets = {
    duck: new Animation("./assets/duck.png", { fw: 32, fh: 32, delay: 150 }),
    seagull: new Animation("./assets/seagull.png", { fw: 64, fh: 32, delay: 250 }),
    wave: loadImage("./assets/wave.png"),
    cloud: loadImage("./assets/cloud.png"),
  };

  clearColor = "#5581c9";
  playing = true;

  constructor(container: HTMLElement) {
    this.ctx = document.createElement("canvas").getContext("2d")!;
    this.ctx.canvas.style.width = "800px";
    this.ctx.canvas.style.height = "200px";
    this.ctx.canvas.style.position = "relative";
    this.ctx.canvas.style.left = "50%";
    this.ctx.canvas.style.marginTop = "25px";
    this.ctx.canvas.style.transform = "translate(-50%, 0)";
    container.appendChild(this.ctx.canvas);

    this.clear();
    this.resize();

    window.addEventListener("keydown", ({ code }) => (this.keys[code] = true));
    window.addEventListener("keyup", ({ code }) => (this.keys[code] = false));

    this.entities.push(new Duck(this));
    this.entities.push(new Seagull(this));
  }

  update() {
    this.entities.forEach((e) => e.update());
  }

  draw(t: number) {
    if (!this.playing) t = 0;
    this.resize();
    this.clear();

    this.entities.forEach((e) => e.draw(t));
    this.drawEnvironment();
  }

  drawEnvironment() {
    const ctx = this.ctx;
    const t = Date.now() / 5;
    {
      // waves
      const scale = 3;
      const width = this.assets.wave.width * scale;
      const height = this.assets.wave.height * scale;
      const n = Math.ceil(this.width() / width) + 1;
      const offset = width - (t % width);
      for (let i = 0; i < n; ++i) {
        ctx.save();
        ctx.translate(offset + i * width - width, this.height() - height);
        ctx.globalAlpha = 0.8;
        drawImage(ctx, this.assets.wave, scale);
        ctx.restore();
      }
    }
    {
      // clouds
      const scale = 3;
      const space = this.assets.cloud.width * scale * 2;
      const width = this.assets.cloud.width * scale;
      const height = this.assets.cloud.height * scale;
      const n = Math.ceil(this.width() / (space + width)) + 1;
      const offset = space + width - (t % (space + width));
      for (let i = 0; i < n; ++i) {
        ctx.save();
        ctx.translate(offset + i * (space + width) - (space + width), height / 12);
        drawImage(ctx, this.assets.cloud, scale);
        ctx.restore();
      }
    }
  }

  reset() {}

  width() {
    return this.ctx.canvas.width;
  }

  height() {
    return this.ctx.canvas.height;
  }

  resize() {
    const canvas = this.ctx.canvas;
    if (canvas.clientWidth !== canvas.width || canvas.clientHeight !== canvas.height) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
  }

  clear() {
    const ctx = this.ctx;
    const fillStyle = ctx.fillStyle;
    ctx.fillStyle = this.clearColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = fillStyle;
  }
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const _game = new Game(app);

// @ts-ignore
window._game = _game;

loop(
  30,
  () => _game.update(),
  (t) => _game.draw(t)
);
