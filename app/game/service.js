import Service from '@ember/service';

const EXTREME_MODE_LIMIT = 500;
const TURBO_MODE_LIMIT = 250;

export default Service.extend({
  config: null,
  gameInstance: null,

  player: null,
  stars: null,
  bombs: null,
  car: null,
  score: 0,
  lives: 3,
  scoreText: null,
  livesText: null,
  gameOver: false,

  isTouchActive: false,

  init() {
    this._super(...arguments);

    let service = this;
    let offsettedWidth = window.innerWidth - 20; // subtracting values to offsett for margins and other components
    let offsettedHeight = window.innerHeight - 120;
    let width = 400 < offsettedWidth ? 400 : offsettedWidth;
    let height = 700 < offsettedHeight ? 700 : offsettedHeight;

    this.set('config', {
      type: Phaser.AUTO,
      width, height,
      physics: {
        default: 'arcade'
      },
      parent: 'game-container',
      scene: {
        preload: function (...args) { service.preloadHook.call(this, service, ...args) },
        create: function (...args) { service.createHook.call(this, service, ...args) },
        update: function (...args) { service.updateHook.call(this, service, ...args) }
      }
    });
  },

  setConfig(config) {
    let oldConfig = this.get('config');
    let newConfig = Object.assign(oldConfig, config);
    this.set('config', newConfig);
  },

  reset() {
    this.setProperties({
      player: null,
      stars: null,
      bombs: null,
      car: null,
      score: 0,
      lives: 3,
      scoreText: null,
      livesText: null,
      gameOver: false
    });
  },

  createGame() {
    let gameInstance = new Phaser.Game(this.get('config'));
    this.set('gameInstance', gameInstance);
  },

  preloadHook () {
    this.load.setBaseURL('./assets');

    this.load.image('brick', 'brick.png');
    this.load.image('car', 'car.png');
    this.load.image('road', 'road.png');
    this.load.image('particle', 'particle.png');
  },

  createHook (service) {
    let { width, height } = service.config;
    let carPosition = height * 0.8;
    let brickSize = 50;
    let distanceAdjustment = 500;
    let distanceToCover = height + brickSize + distanceAdjustment;
    let durationMultipler = 200;
    let duration = durationMultipler * distanceToCover / brickSize;
    let brickColumns = [width/8, 3*width/8, 5*width/8, 7*width/8];

    let backgroundSprite = this.add.tileSprite(0, 0, 884, height, 'road').setOrigin(0, 0);
    backgroundSprite.displayWidth = width;
    service.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });
    service.livesText = this.add.text(16, height - (16 + 32), 'Lives: 3', { fontSize: '32px', fill: '#ff8497' });

    let bricks = this.physics.add.group();
    service.generateBricks.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});

    service.car = this.physics.add.sprite(width/2, carPosition, 'car').setScale(0.75);
    service.car.setCollideWorldBounds(true);
    this.physics.add.overlap(service.car, bricks, (...args) => { service.hitCar.call(this, service, ...args) }, null, this);

    // let platforms = this.physics.add.staticGroup();
    // platforms.create(width/2, height, 'ground').setScale(2).refreshBody();
    // platforms.create(600, 400, 'ground');
    // platforms.create(50, 250, 'ground');
    // platforms.create(750, 220, 'ground');
    // service.player = this.physics.add.sprite(width/2, height/2, 'dude');
    // service.player.setBounce(0.2);
    // service.player.setCollideWorldBounds(true);
    // service.player.body.setGravityY(300);
    // this.physics.add.collider(service.player, platforms, () => {}); // callback is optional
    // service.stars = this.physics.add.group({
    //   key: 'star',
    //   repeat: 11,
    //   setXY: { x: 12, y: 0, stepX: 70 }
    // });
    // service.stars.children.iterate(function (child) {
    //   child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
    // });
    // this.physics.add.collider(service.stars, platforms, () => {});
    // this.physics.add.overlap(service.player, bricks, (...args) => service.collectStar.call(this, service, ...args), null, this);
    // service.bombs = this.physics.add.group();
    // this.physics.add.collider(service.bombs, platforms);
    // this.physics.add.collider(bricks, service.player, (...args) => service.hitBomb.call(this, service, ...args), null, this);
  },

  updateHook (service) {
    if (service.gameOver) return;
    let cursors = this.input.keyboard.createCursorKeys();
    let turnAngle = 15, turnDuration = 150, carSpeed = 200;
    let extremeMode = service.get('score') >= EXTREME_MODE_LIMIT;

    let { x: carX } = service.car;
    let { x: touchX, wasTouch, justDown, justUp } = this.input.manager.activePointer;

    if (wasTouch && justDown) { service.isTouchActive = true; }
    if (wasTouch && justUp) { service.isTouchActive = false; }

    let rightSideTouched = touchX >= carX && service.isTouchActive;
    let leftSideTouched = touchX < carX && service.isTouchActive;

    // Make the car roughly 50% faster in extreme mode
    if (extremeMode) {
      turnDuration = 100;
      carSpeed = 300;
    }

    if (cursors.left.isDown || leftSideTouched) {
      service.car.setVelocityX(0 - carSpeed);
      if (this.tweens.getTweensOf(service.car).length) return;
      this.tweens.add({
        targets: service.car,
        duration: turnDuration,
        angle: 0 - turnAngle
      });
    }
    else if (cursors.right.isDown || rightSideTouched) {
      service.car.setVelocityX(carSpeed);
      if (this.tweens.getTweensOf(service.car).length) return;
      this.tweens.add({
        targets: service.car,
        duration: turnDuration,
        angle: turnAngle
      });
    }
    else {
      service.car.setVelocityX(0);
      this.tweens.killTweensOf(service.car);
    }
  },
  addBrick(service, {duration, brickColumns, distanceToCover, bricks, brickSize}) {
    if (service.gameOver) return;

    // Increase speed by 30% when you cross a score of 500
    let turboMode = service.get('score') >= TURBO_MODE_LIMIT;
    // Increase speed by 60% when you cross a score of 500
    let extremeMode = service.get('score') >= EXTREME_MODE_LIMIT;
    let angle = 0;

    if (extremeMode) {
      duration *= 0.4;
      brickSize *= 1.25;
      angle = Phaser.Math.Between(-360, 360);
    } else if (turboMode) {
      duration *= 0.7;
      angle = Phaser.Math.Between(-720, 720);
    }

    let index = Phaser.Math.Between(0, 3);
    let brick = bricks.create(brickColumns[index], 0 - brickSize, 'brick').setDisplaySize(brickSize, brickSize);



    service.incrementProperty('score', 10);
    service.scoreText.setText('Score: ' + service.score);

    this.tweens.add({
      targets: brick,
      y: distanceToCover,
      duration, angle
    });

    setTimeout(() => {
      if (service.gameOver) return;
      service.removeBrick(brick, bricks);
    }, duration);
  },
  removeBrick(brick, bricks) {
    bricks.remove(brick);
  },
  generateBricks(service, {duration, brickColumns, distanceToCover, bricks, brickSize}) {
    setTimeout(() => {
      if (service.gameOver) return;
      service.addBrick.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});
      service.generateBricks.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});
    }, 1000);
  },
  hitCar(service, car, brick) {
    let particles = this.add.particles('particle');
    let emitter = particles.createEmitter({
      speed: 100,
      scale: { start: 1, end: 0 },
      blendMode: 'ADD'
    });
    emitter.startFollow(brick);
    setTimeout(particles.destroy, 3000);
    brick.disableBody(true, true);
    service.set('score', parseInt(service.get('score') * 0.7));
    service.scoreText.setText('Score: ' + service.score);
    service.lives--;
    service.livesText.setText('Lives: ' + service.lives);

    if (!service.lives) {
      service.endGame.call(this, service);
    }
  },
  endGame(service) {
    service.set('gameOver', true);
    this.tweens.killAll();
    this.physics.pause();
    this.add.text(service.config.width/2 + 30, 12, 'GAME.\nOVER.', { fontSize: '48px', fill: '#FFF' });
    // setTimeout(() => service.gameInstance.destroy(), 1000);
  }
});
