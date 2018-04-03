import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { reads } from '@ember/object/computed';

export default Component.extend({
  classNames: 'game-component-container',
  game: service(),

  isUnstarted: true,
  isGameOver: reads('game.gameOver'),

  didInsertElement() {
    this._super(...arguments);
  },

  createGame() {
    this.set('isUnstarted', false);
    if (this.get('game.gameInstance')) {
      this.get('game.gameInstance').destroy();
      this.get('game').reset();
      this.element.querySelector('#game-component canvas').remove();
    }
    this.get('game').setConfig({ parent: this.element.querySelector('#game-component') });
    this.get('game').createGame();
  }
});
