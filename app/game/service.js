import Service from '@ember/service';

/**
 * TURBO_MODE_LIMIT: Beyond the score set by this, the bricks move 30% faster, and they spin a little.
 * EXTREME_MODE_LIMIT: Beyond the score set by this, the bricks move 60% faster, they are 25% larger, they spin twice as fast, and the car is about 50% quicker.
 * @type {number}
 */
const TURBO_MODE_LIMIT = 250;
const EXTREME_MODE_LIMIT = 500;

export default Service.extend({
  // Phaser configuration object, initialized in `init`
  config: null,
  // Phaser.Game instance.
  gameInstance: null,

  // Car sprite object, initialized in `createHook`
  car: null,

  // Game Score. Intended to be publicly accessible.
  score: 0,
  // Lives. Intended to be publicly accessible.
  lives: 3,

  /**
   * Text shown at the top (score) and bottom (lives) of the screen.
   * These are Phaser Text Entities.
   */
  scoreText: null,
  livesText: null,
  /**
   *   Public property.
   *   Indicates if the game is over or not.
   */
  gameOver: false,

  /**
   *   Private property.
   *   Updated in `updateHook`.
   *   @type {Boolean}
   *   true: if the user has touched and held on the screen.
   *   false: if the user has stopped touching the screen.
   */
  isTouchActive: false,

  init() {
    this._super(...arguments);

    let service = this;

    /**
     * The game window side needs to be at max 400x700.
     * For mobile phones, the viewport may be smaller than that, hence the rendered area may be out of the screen.
     * As such, the canvas size is the Min of 400x700 and the windows' HEIGHTxWIDTH, independently on each axis.
     */
    let offsettedWidth = window.innerWidth - 20; // subtracting values to offsett for margins and other components
    let offsettedHeight = window.innerHeight - 120;
    let width = Math.min(offsettedWidth, 400);
    let height = Math.min(offsettedHeight, 700);

    this.set('config', {
      type: Phaser.AUTO,
      width, height,
      physics: {
        default: 'arcade'
      },
      parent: 'game-container',
      scene: {
        /**
         * In each of these scene methods, they are internally called with the context of the Phaser Class,
         * and as such these functions lose the context of the function itself.
         *
         * We need both the contexts from the service, and the Phaser Class.
         * So this is how I decided to do it.
         */
        preload: function (...args) { service.preloadHook.call(this, service, ...args) },
        create: function (...args) { service.createHook.call(this, service, ...args) },
        update: function (...args) { service.updateHook.call(this, service, ...args) }
      }
    });
  },

  /**
   * Public API.
   * Allows setting custom config on the Phaser.Game constructor.
   * The use of it is optional, if you have an element already in the DOM with the ID `game-container`.
   * @param config
   */
  setConfig(config) {
    let oldConfig = this.get('config');
    let newConfig = Object.assign(oldConfig, config);
    this.set('config', newConfig);
  },

  /**
   * Public API.
   * Set game service properties back to their initial states.
   */
  reset() {
    this.setProperties({
      car: null,
      score: 0,
      lives: 3,
      scoreText: null,
      livesText: null,
      gameOver: false
    });
  },

  /**
   * Public API.
   * Create a new game using this.
   */
  createGame() {
    let gameInstance = new Phaser.Game(this.get('config'));
    this.set('gameInstance', gameInstance);
  },

  /**
   * Phaser scene preload method hook.
   * Load any assets, and set Phaser Scene properties here.
   * `this` refers to the Phaser Scene context.
   */
  preloadHook () {
    this.load.setBaseURL('./assets');

    this.load.image('brick', 'brick.png');
    this.load.image('car', 'car.png');
    this.load.image('road', 'road.png');
    this.load.image('particle', 'particle.png');
  },

  /**
   * Phaser scene create hook.
   * Build the scene, add in sprites, physics, statics, etc. in this hook.
   * `this` refers to the Phaser Scene context.
   * @param service
   */
  createHook (service) {
    let { width, height } = service.config;
    let carPosition = height * 0.8;
    let brickSize = 50;
    let distanceAdjustment = 500;
    let distanceToCover = height + brickSize + distanceAdjustment;
    let durationMultipler = 200;  // The higher this is, the slower the bricks are.
    let duration = durationMultipler * distanceToCover / brickSize; // How long the bricks will take to move across the screen.
    let brickColumns = [width/8, 3*width/8, 5*width/8, 7*width/8];  // 4 columns along which the bricks can move.

    let backgroundSprite = this.add.tileSprite(0, 0, 884, height, 'road').setOrigin(0, 0);
    backgroundSprite.displayWidth = width;
    service.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#FFF' });
    service.livesText = this.add.text(16, height - (16 + 32), 'Lives: 3', { fontSize: '32px', fill: '#ff8497' });

    let bricks = this.physics.add.group();
    service.generateBricks.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});

    service.car = this.physics.add.sprite(width/2, carPosition, 'car').setScale(0.75);
    service.car.setCollideWorldBounds(true);
    this.physics.add.overlap(service.car, bricks, (...args) => { service.hitCar.call(this, service, ...args) }, null, this);
  },

  /**
   * Phaser scene update hook.
   * Handle user input, and react accordingly, here.
   * `this` refers to the Phaser Scene context.
   * @param service
   */
  updateHook (service) {
    if (service.gameOver) return;
    let cursors = this.input.keyboard.createCursorKeys();
    let turnAngle = 15, turnDuration = 150, carSpeed = 200;
    let extremeMode = service.get('score') >= EXTREME_MODE_LIMIT;

    // Identify the specifics of a touch input, and determine if the screen was touched on either side of the car.
    let { x: carX } = service.car;
    let { x: touchX, wasTouch, justDown, justUp } = this.input.manager.activePointer;

    if (wasTouch && justDown) { service.isTouchActive = true; }
    if (wasTouch && justUp) { service.isTouchActive = false; }

    let rightSideTouched = touchX >= carX && service.isTouchActive;
    let leftSideTouched = touchX < carX && service.isTouchActive;

    let leftMovementTriggered = cursors.left.isDown || leftSideTouched;
    let rightMovementTriggered = cursors.right.isDown || rightSideTouched;
    // Make the car roughly 50% faster in extreme mode
    if (extremeMode) {
      turnDuration = 100;
      carSpeed = 300;
    }

    /**
     * Depending on the condition,
     * either move the car left while slightly turning to the left,
     * or move the car right while slightly turning to the right,
     * or stop the car and stop any turning motions.
     */
    if (leftMovementTriggered) {
      service.car.setVelocityX(0 - carSpeed);
      if (this.tweens.getTweensOf(service.car).length) return;
      this.tweens.add({
        targets: service.car,
        duration: turnDuration,
        angle: 0 - turnAngle
      });
    }
    else if (rightMovementTriggered) {
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

  /**
   * Add a brick at one of the valid random positions.
   * @param service
   * @param duration
   * @param brickColumns
   * @param distanceToCover
   * @param bricks
   * @param brickSize
   */
  addBrick(service, {duration, brickColumns, distanceToCover, bricks, brickSize}) {
    // If game is over, freeze brick creation if it was already scheduled.
    if (service.gameOver) return;

    let turboMode = service.get('score') >= TURBO_MODE_LIMIT;
    let extremeMode = service.get('score') >= EXTREME_MODE_LIMIT;
    let angle = 0;

    /**
     * In Extreme Mode
     * Bricks come 60% faster
     * Bricks are 25% larger
     * Bricks may rotate at most 4 full rotations in either direction.
     */
    if (extremeMode) {
      duration *= 0.4;
      brickSize *= 1.25;
      angle = Phaser.Math.Between(-1440, 1440);
    }

    /**
     * In Turbo Mode
     * Bricks come 30% faster
     * Bricks may rotate at most 2 full rotations in either direction.
     */
    else if (turboMode) {
      duration *= 0.7;
      angle = Phaser.Math.Between(-720, 720);
    }

    // Pick a column position where a brick can be spawned, and then spawn it.
    let index = Phaser.Math.Between(0, 3);
    let brick = bricks.create(brickColumns[index], 0 - brickSize, 'brick').setDisplaySize(brickSize, brickSize);

    // Add 10 points for each brick created.
    // The more bricks you survive to see being created, the more you score, basically.
    service.incrementProperty('score', 10);
    service.scoreText.setText('Score: ' + service.score);

    this.tweens.add({
      targets: brick,
      y: distanceToCover,
      duration, angle
    });

    /**
     * The brick reaches the end of it's path after `duration` amount of time.
     * So, after `duration` amount of time, we make sure that brick is removed.
     */
    setTimeout(() => {
      // If game is over, freeze brick removal.
      if (service.gameOver) return;
      service.removeBrick(brick, bricks);
    }, duration);
  },

  /**
   * Remove a brick from the bricks group.
   * Both params are Phaser objects.
   * @param brick  : Phaser sprite object.
   * @param bricks : Phaser physics dynamic group.
   */
  removeBrick(brick, bricks) {
    bricks.remove(brick);
  },

  /**
   * Generate a new brick every 1000ms/1sec.
   * Recursively call itself every second to call `addBrick` which then adds a brick.
   * @param service
   * @param duration
   * @param brickColumns
   * @param distanceToCover
   * @param bricks
   * @param brickSize
   */
  generateBricks(service, {duration, brickColumns, distanceToCover, bricks, brickSize}) {
    setTimeout(() => {
      // If game is over, freeze brick production.
      if (service.gameOver) return;
      service.addBrick.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});
      service.generateBricks.call(this, service, {duration, brickColumns, distanceToCover, bricks, brickSize});
    }, 1000);
  },

  /**
   * Handler for when the car hits a brick.
   * It disables the brick, adds an emitter onto it to show that flarey exploded visual, and after 3 seconds, destroys that.
   * @param service
   * @param car
   * @param brick
   */
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

    // Lose 30% of your score current score if you hit a brick.
    service.set('score', parseInt(service.get('score') * 0.7));
    service.scoreText.setText('Score: ' + service.score);
    // Lose one life if you hit a brick.
    service.lives--;
    service.livesText.setText('Lives: ' + service.lives);

    // End game if all lives are lost.
    if (!service.lives) {
      service.endGame.call(this, service);
    }
  },

  /**
   * Handle a game ending.
   * Set `gameOver` property to `true`.
   * End any running animations/Tweens.
   * Halt any active physics effects.
   * Display `GAME.\nOVER.` on the top right area of the screen.
   * @param service
   */
  endGame(service) {
    service.set('gameOver', true);
    this.tweens.killAll();
    this.physics.pause();
    this.add.text(service.config.width/2 + 30, 12, 'GAME.\nOVER.', { fontSize: '48px', fill: '#FFF' });
  }
});
