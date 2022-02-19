import "./style.css";
import { loop } from "uloop";

// TODO: fix ball phasing through paddle
// when starting from left and when both paddles have not moved

const lerp = (a: number, b: number, t: number) => a + t * (b - a);

class Vec2 {
  constructor(public x: number, public y: number) {}
  add(other: Vec2) {
    return new Vec2(this.x + other.x, this.y + other.y);
  }
  sub(other: Vec2) {
    return new Vec2(this.x - other.x, this.y - other.y);
  }
  len() {
    return Math.hypot(this.x, this.y);
  }
  clone() {
    return new Vec2(this.x, this.y);
  }
  static lerp(a: Vec2, b: Vec2, t: number) {
    return new Vec2(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }
}
const v2 = (x = 0, y = 0) => new Vec2(x, y);

function clamp(v: number, min: number, max: number) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

class AABB {
  constructor(public center = v2(0, 0), public half = v2(0, 0)) {}

  collide(that: AABB) {
    const dx = that.center.x - this.center.x;
    const px = that.half.x + this.half.x - Math.abs(dx);
    const dy = that.center.y - this.center.y;
    const py = that.half.y + this.half.y - Math.abs(dy);
    if (px <= 0 || py <= 0) {
      return null;
    }

    if (px < py) {
      return v2(-px * Math.sign(dx), 0);
    } else {
      return v2(0, -py * Math.sign(dy));
    }
  }

  draw(ctx: CanvasRenderingContext2D, color: string) {
    ctx.save();
    ctx.resetTransform();
    ctx.translate(this.center.x, this.center.y);
    ctx.strokeStyle = color;
    ctx.strokeRect(-this.half.x, -this.half.y, this.half.x * 2, this.half.y * 2);
    ctx.restore();
  }
}

class Circle {
  constructor(public center = v2(0, 0), public radius = 1) {}

  collide(that: AABB) {
    const first = that;
    const second = this;
    const center = second.center;
    const aabb_half_extents = first.half;
    const aabb_center = first.center;

    const delta = v2(center.x - aabb_center.x, center.y - aabb_center.y);
    const closest = v2(
      aabb_center.x + clamp(delta.x, -aabb_half_extents.x, aabb_half_extents.x),
      aabb_center.y + clamp(delta.y, -aabb_half_extents.y, aabb_half_extents.y)
    );

    const difference = closest.sub(center);
    const overlap = second.radius - difference.len();
    if (overlap > 0) {
      return overlap;
      /* return {
        overlap,
        direction: v2(Math.sign(difference.x), Math.sign(difference.y)),
      }; */
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D, color: string) {
    ctx.save();
    ctx.resetTransform();
    ctx.translate(this.center.x, this.center.y);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#FF00FF";
    ctx.stroke();
    ctx.restore();
  }
}

class Paddle {
  game: Game;

  pos: { prev: Vec2; current: Vec2 };
  vel: Vec2;

  size: Vec2;
  color: string;
  player: "p1" | "p2";

  top: AABB;
  bottom: AABB;

  constructor(game: Game, player: "p1" | "p2", size: Vec2, color: string) {
    this.game = game;
    const pos = player === "p1" ? v2(20, game.height() / 2) : v2(game.width() - 20, game.height() / 2);
    this.pos = { prev: pos.clone(), current: pos.clone() };
    this.vel = v2();
    this.size = size.clone();
    this.color = color;
    this.player = player;
    this.top = new AABB(v2(pos.x, pos.y - size.y / 4), v2(size.x / 2, size.y / 4));
    this.bottom = new AABB(v2(pos.x, pos.y + size.y / 4), v2(size.x / 2, size.y / 4));
  }

  move() {
    this.vel.x = 0;
    this.vel.y = 0;
    const up = this.player === "p1" ? this.game.keys.KeyW : this.game.keys.ArrowUp;
    const down = this.player === "p1" ? this.game.keys.KeyS : this.game.keys.ArrowDown;
    if (up) this.vel.y -= 10;
    if (down) this.vel.y += 10;

    this.pos.prev = this.pos.current;
    this.pos.current = this.pos.current.add(this.vel);
    this.pos.current.y = clamp(this.pos.current.y, this.size.y / 2, this.game.height() - this.size.y / 2);
    this.top.center.y = this.pos.current.y - this.size.y / 4;
    this.bottom.center.y = this.pos.current.y + this.size.y / 4;
  }

  draw(t: number) {
    const ctx = this.game.ctx;
    const pos = Vec2.lerp(this.pos.prev, this.pos.current, t);
    ctx.save();
    ctx.resetTransform();
    ctx.translate(pos.x, pos.y);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y);
    if (this.game.debug) {
      this.top.draw(ctx, "#FF00FF");
      this.bottom.draw(ctx, "#FF00FF");
    }
    ctx.restore();
  }

  reset() {
    const pos =
      this.player === "p1" ? v2(20, this.game.height() / 2) : v2(this.game.width() - 20, this.game.height() / 2);
    this.pos = { prev: pos.clone(), current: pos.clone() };
    this.vel = v2();
    this.top.center = v2(pos.x, pos.y - this.size.y / 4);
    this.bottom.center = v2(pos.x, pos.y + this.size.y / 4);
  }
}

class Ball {
  game: Game;
  pos: { prev: Vec2; current: Vec2 };
  vel: Vec2;
  speed: number;
  radius: number;
  color: string;
  circle: Circle;

  constructor(game: Game, radius: number, color: string) {
    this.game = game;
    const pos = v2(game.width() / 2, game.height() / 2);
    this.pos = { prev: pos.clone(), current: pos.clone() };
    this.speed = 7.5;
    this.vel = v2((Math.random() > 0.5 ? 1 : -1) * this.speed, 0);
    this.radius = radius;
    this.color = color;
    this.circle = new Circle(pos.clone(), radius);
  }

  move() {
    // position update
    this.pos.prev = this.pos.current;
    this.pos.current = this.pos.current.add(this.vel);
    this.circle.center = this.pos.current.clone();
  }

  score(): "p1" | "p2" | null {
    let bounced: "p1" | "p2" | null = null;
    if (this.pos.current.y - this.radius < 0) {
      this.pos.current.y = this.radius;
      this.vel.y *= -1;
    }
    if (this.pos.current.y + this.radius > this.game.height()) {
      this.pos.current.y = this.game.height() - this.radius;
      this.vel.y *= -1;
    }
    if (this.pos.current.x - this.radius < 0) {
      this.pos.current.x = this.radius;
      this.vel.x *= -1;
      bounced = "p2";
    }
    if (this.pos.current.x + this.radius > this.game.width()) {
      this.pos.current.x = this.game.width() - this.radius;
      this.vel.x *= -1;
      bounced = "p1";
    }
    if (bounced) {
      this.game.sounds.kuso.play();
      this.speed += 0.5;
      this.game.ctx.canvas.classList.add("shake");
      setTimeout(() => this.game.ctx.canvas.classList.remove("shake"), 100);
    }
    return bounced;
  }

  bounce(paddle: Paddle, player: "p1" | "p2") {
    const top = this.circle.collide(paddle.top);
    const bottom = this.circle.collide(paddle.bottom);

    const direction = player === "p1" ? 1 : -1;
    if (top !== null && bottom !== null) {
      if (top > bottom) {
        this.vel.x = direction * this.speed;
        this.vel.y = -this.speed;
      } else {
        this.vel.x = direction * this.speed;
        this.vel.y = this.speed;
      }
    } else if (top !== null) {
      this.vel.x = direction * this.speed;
      this.vel.y = -this.speed;
    } else if (bottom !== null) {
      this.vel.x = direction * this.speed;
      this.vel.y = this.speed;
    }

    if (top !== null || bottom !== null) {
      this.game.sounds.peko.play();
      this.speed += 0.5;
      this.game.ctx.canvas.classList.add("shake");
      setTimeout(() => this.game.ctx.canvas.classList.remove("shake"), 100);
    }
  }

  draw(t: number) {
    const ctx = this.game.ctx;
    const pos = Vec2.lerp(this.pos.prev, this.pos.current, t);
    ctx.save();
    ctx.resetTransform();
    ctx.translate(pos.x, pos.y);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    if (this.game.debug) this.circle.draw(ctx, "#FF00FF");
    ctx.restore();
  }

  reset() {
    const pos = v2(this.game.width() / 2, this.game.height() / 2);
    this.pos = { prev: pos.clone(), current: pos.clone() };
    this.vel = v2(this.speed, 0);
    this.circle.center = pos.clone();
  }
}

class Ticker {
  interval = -1;
  constructor(public fn: () => void) {}

  start(ms: number) {
    this.interval = setInterval(() => this.fn(), ms);
  }

  stop() {
    clearInterval(this.interval);
  }
}

class Game {
  keys = {} as Record<string, boolean>;
  ctx: CanvasRenderingContext2D;
  clearColor = "#000000";

  sounds = {
    kuso: new Audio("./kuso.mp3"),
    peko: new Audio("./peko.ogg"),
  };

  ball: Ball;
  p1: Paddle;
  p2: Paddle;

  playing = true;
  showVictoryText = false;
  victoryTextBlink: Ticker;
  score = {
    p1: 0,
    p2: 0,
  };
  winScore = 10;
  debug = false;

  constructor(container: HTMLElement) {
    this.ctx = document.createElement("canvas").getContext("2d")!;
    this.ctx.canvas.style.width = "700px";
    this.ctx.canvas.style.height = "600px";
    this.ctx.canvas.style.position = "absolute";
    this.ctx.canvas.style.left = "50%";
    this.ctx.canvas.style.top = "50%";
    this.ctx.canvas.style.transform = "translate(-50%, -50%)";
    container.appendChild(this.ctx.canvas);

    this.clear();
    this.resize();

    window.addEventListener("keydown", ({ code }) => (this.keys[code] = true));
    window.addEventListener("keyup", ({ code }) => (this.keys[code] = false));

    this.ball = new Ball(this, 25, "#FFFFFF");
    this.p1 = new Paddle(this, "p1", v2(20, 125), "#FFFFFF");
    this.p2 = new Paddle(this, "p2", v2(20, 125), "#FFFFFF");

    this.victoryTextBlink = new Ticker(() => (this.showVictoryText = !this.showVictoryText));
  }

  update() {
    if (!this.playing) {
      if (this.keys.Space) this.reset();
      return;
    }

    this.ball.move();
    this.p1.move();
    this.p2.move();

    const score = this.ball.score();
    if (score) this.score[score] += 1;
    this.win();

    this.ball.bounce(this.p1, "p1");
    this.ball.bounce(this.p2, "p2");
  }

  draw(t: number) {
    if (!this.playing) t = 0;
    this.resize();
    this.clear();
    this.p1.draw(t);
    this.p2.draw(t);
    this.ball.draw(t);
    this.drawScore();
    this.drawVictory();
  }

  drawScore() {
    const ctx = this.ctx;
    const text = `${this.score.p1} | ${this.score.p2}`;
    ctx.save();
    ctx.resetTransform();
    ctx.translate(this.width() / 2, 75);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px monospace";
    ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
    ctx.restore();
  }

  win() {
    let winner: "p1" | "p2" | null = null;
    if (this.score.p1 === this.winScore) winner = "p1";
    if (this.score.p2 === this.winScore) winner = "p2";
    if (winner) {
      this.playing = false;
      this.showVictoryText = true;
      this.victoryTextBlink.start(500);
    }
  }

  reset() {
    this.ball.reset();
    this.p1.reset();
    this.p2.reset();
    this.victoryTextBlink.stop();
    this.showVictoryText = false;
    this.score.p1 = 0;
    this.score.p2 = 0;
    this.playing = true;
  }

  drawVictory() {
    if (!this.showVictoryText) return;
    const ctx = this.ctx;
    const text = `${this.score.p1 > this.score.p2 ? "Left" : "Right"} paddle won!`;
    ctx.save();
    ctx.resetTransform();
    ctx.translate(this.width() / 2, this.height() / 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "32px monospace";
    ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
    ctx.restore();
  }

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

loop(
  30,
  () => _game.update(),
  (t) => _game.draw(t)
);
