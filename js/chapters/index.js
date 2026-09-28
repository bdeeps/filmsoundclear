// The box and its chapters, in reading order.
import production from './production.js';
import foley from './foley.js';
import design from './design.js';
import adr from './adr.js';
import mix from './mix.js';
import theatre from './theatre.js';

export const BOX = { slug: 'filmsoundclear', title: 'FilmSoundClear' };
export const CHAPTERS = [production, foley, design, adr, mix, theatre];
