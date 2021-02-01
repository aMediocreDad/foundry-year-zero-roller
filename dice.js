/*
 * ===============================================================================
 *  UNIVERSAL YEAR ZERO DICE ROLLER
 *   FOR THE FOUNDRY VTT
 * ===============================================================================
 * Author: @Stefouch
 * Licence: MIT
 * ===============================================================================
 * Content:
 * 
 * - YearZeroRollManager: Interface for registering dice & managing the cache
 *     of pushable rolls.
 * 
 * - YZRoller: Helper class for YZ dice rolls building.
 * 
 * - YearZeroRoll: Custom implementation of the default Foundry Roll class.
 * 
 * - YearZeroDie: Custom implementation of the default Foundry DieTerm class.
 * 
 * - (Base/Skill/Gear/etc..)Die: Extends of the YearZeroDie class with specific
 *     DENOMINATION and LOCKED_VALUE constants.
 * 
 * ===============================================================================
 */


/* -------------------------------------------- */
/*  Definitions                                 */
/* -------------------------------------------- */

/**
 * Defines a Year Zero game.
 * - `myz`: Mutant Year Zero
 * - `fbl`: Forbidden Lands
 * - `alien`: Alien RPG
 * - `cor`: Coriolis The Third Horizon
 * - `tales`: Tales From the Loop & Things From the Flood
 * - `vae`: Vaesen
 * - `t2k`: Twilight 2000
 * @typedef {string} GameTypeString
 */

/**
 * Defines a type of a YZ die.
 * 
 * `base`, `skill`, `gear`, `neg`, `stress`, `artoD8`, `artoD10`, `artoD12`, `a`, `b`, `c`, `d`, `ammo`, `loc`
 * @typedef {string} DieTypeString
 */

 /**
  * An object with quantities of dice
  * @typedef {Object<DieTypeString, number>} DiceQuantities
  */


/* -------------------------------------------- */
/*  Custom Dice Registration                    */
/* -------------------------------------------- */

/**
 * Interface for registering Year Zero dice
 * and creating a cache for the pushable rolls.
 * 
 * To register the game and its dice,
 * call the static `YearZeroRollManager.register()` method
 * at the end of the `init` or `setup` Hooks.
 * 
 * To save and retrieve dice for pushes, use the
 * static methods `.cache(roll)` and `.grab(id)`.
 * 
 * @extends {Collection} The Foundry extends of Map
 * @abstract
 * @interface
 * 
 * @example
 * import { YearZeroRollManager } from 'xxxx.js';
 * Hooks.once('init', function() {
 *   ...
 *   YearZeroRollManager.register();
 * });
 * 
 */
export class YearZeroRollManager extends Collection {
  /**
   * Adds a roll to the cache.
   * @param {YearZeroRoll} roll Year Zero Roll to cache
   * @returns {Collection} The cached Collection (Map)
   * @static
   */
  static cache(roll) {
    return game.yzrolls.set(roll._id, roll);
  }

  /**
   * Retrieves a roll from the cache with its ID.
   * @param {string} id               Reference (ID) of the roll to retrieve
   * @param {boolean} [strict=false]  Throws an Error if the requested id does not exist, otherwise return null. Default is `false`
   * @returns {YearZeroRoll|undefined} Returns `undefined` if nothing was found or if the cached roll wasn't pushable
   * @static
   */
  static grab(id, strict = false) {
    return game.yzrolls.get(id, strict);
  }

  /**
   * Cleanse the cache.
   * @returns {boolean} `true` if the cache was cleansed
   * @static
   */
  static clean() {
    if (!game.yzrolls) return false;
    game.yzrolls.clear();
    console.warn(`${YearZeroRollManager.name} | Cache cleansed.`);
    return true;
  }

  /** @override */
  set(id, roll) {
    // 1 — Checks if the cache exists.
    if (!game.yzrolls || !(game.yzrolls instanceof this)) {
      YearZeroRollManager._initialize();
    }
    // 2 — Validates the roll to cache.
    if (!(roll instanceof YearZeroRoll)) {
      throw new TypeError(`${YearZeroRollManager.name} | Can only cache YearZeroRoll objects.`);
    }
    // 3 — Caches only pushable rolls.
    if (!roll.pushable) return this;
    // 4 — Caches the roll.
    return super.set(id, roll);
  }

  /** @override */
  get(id, strict) {
    /** @type {YearZeroRoll} */
    const roll = super.get(id, { strict });
    if (!roll) return undefined;
    if (!roll.pushable) {
      super.delete(roll._id);
      return undefined;
    }
    return roll;
  }

  /**
   * Registers the Year Zero dice for the specified game
   * and the cache for the pushable Roll objects.
   * 
   * You must call this method in `Hooks.once('init')`.
   * 
   * @param {GameTypeString} yzGame The game used (for the choice of die types to register). If omitted, registers all the dice.
   * @static
   */
  static register(yzGame) {
    // Registers the dice.
    YearZeroRollManager.registerDice(yzGame);

    // Creates the dice cache.
    if (game.yzrolls) {
      console.warn(`${YearZeroRollManager.name} | Overwritting "game.yzrolls"`);
    }
    YearZeroRollManager._initialize();
    console.log(`${YearZeroRollManager.name} | Registration complete!`);
  }

  /**
   * Registers all the Year Zero Dice.
   * @param {?GameTypeString} game The game used (for the choice of die types to register). If omitted, registers all the dice.
   * @static
   */
  static registerDice(game) {
    // Registers all the dice if `game` is omitted.
    if (!game) {
      for (const g of YZRoller.GAMES) {
        const diceTypes = YZRoller.DIE_TYPES_MAP[g];
        for (const type of diceTypes) YearZeroRollManager.registerDie(type);
      }
    }
    else {
      // Checks the game validity.
      if (!YZRoller.GAMES.includes(game)) throw new GameTypeError(game);

      // Registers the game's dice.
      const diceTypes = YZRoller.DIE_TYPES_MAP[game];
      for (const type of diceTypes) YearZeroRollManager.registerDie(type);
    }

    // Finally, registers our custom Roll class for Year Zero games.
    CONFIG.Dice.rolls[0] = YearZeroRoll;
  }

  /**
   * Registers a die in Foundry.
   * @param {DieTypeString} type Type of die to register
   * @static
   */
  static registerDie(type) {
    const cls = YZRoller.DIE_TYPES[type];
    if (!cls) throw new DieTypeError(type);

    const deno = cls.DENOMINATION;
    if (!deno) {
      throw new SyntaxError(`Undefined DENOMINATION for "${cls.name}".`);
    }

    // Registers the die in the Foundry CONFIG.
    const reg = CONFIG.Dice.terms[deno];
    if (reg) {
      console.warn(`${YearZeroRollManager.name} | Die Registration: "${deno}" | Overwritting ${reg.name} with "${cls.name}".`);
    }
    else {
      console.log(`${YearZeroRollManager.name} | Die Registration: "${deno}" with ${cls.name}.`);
    }
    CONFIG.Dice.terms[deno] = cls;
  }

  /**
   * @private
   * @static
   */
  static _initialize() {
    game.yzrolls = new this();
    console.log(`${YearZeroRollManager.name} | Cache created.`);
  }
}

/* -------------------------------------------- */
/*  Custom YZ Roller class                      */
/* -------------------------------------------- */

/**
 * Helper class for creating a Year Zero Roll.
 */
export class YZRoller {
  constructor() {
    throw new SyntaxError(`${this.constructor.name} cannot be instanciated. Use static methods instead.`);
  }

  /**
   * Generates a roll based on the number of dice.
   * @param {GameTypeString} game The game used
   * @param {DiceQuantities} dice    An object with quantities of dice
   * @param {?number}  dice.base     The quantity of base dice
   * @param {?number}  dice.skill    The quantity of skill dice
   * @param {?number}  dice.gear     The quantity of gear dice
   * @param {?number}  dice.neg      The quantity of negative dice
   * @param {?number}  dice.stress   The quantity of stress dice
   * @param {?number}  dice.ammo     The quantity of ammo dice
   * @param {?number}  dice.loc      The quantity of location dice
   * @param {?number}  dice.artoD8   The quantity of artoD8 dice
   * @param {?number}  dice.artoD10  The quantity of artoD10 dice
   * @param {?number}  dice.artoD12  The quantity of artoD12 dice
   * @param {?number}  dice.a        The quantity of T2K D12 dice
   * @param {?number}  dice.b        The quantity of T2K D10 dice
   * @param {?number}  dice.c        The quantity of T2K D8 dice
   * @param {?number}  dice.d        The quantity of T2K D6 dice
   * @param {number}  [maxPush=1]    The maximum number of pushes
   */
  static create(game = 'myz', {
    dice = {
      base: 0,
      skill: 0,
      gear: 0,
      neg: 0,
      stress: 0,
      ammo: 0,
      loc: 0,
      artoD8: 0,
      artoD10: 0,
      artoD12: 0,
      a: 0,
      b: 0,
      c: 0,
      d: 0,
    },
    maxPush = 1,
  } = {}) {
    if (!YZRoller.GAMES.includes(game)) {
      throw new GameTypeError(game);
    }

    // Builds the formula.
    const out = [];
    for (const [type, n] of Object.entries(dice)) {
      if (n <= 0) continue;
      const cls = YZRoller.DIE_TYPES[type];
      const deno = cls.DENOMINATION;
      const str = `${n}d${deno}`;
      out.push(str);
    }
    const formula = out.join(' + ');

    // Creates the roll inside the roller.
    const roll = new YearZeroRoll(formula, { game, maxPush }).roll();
    console.warn(roll);
    return roll;
  }

  /**
   * Applies a difficulty modifier to a quantity of dice.
   * @param {GameTypeString} yzGame  The game used (for the choice of die types to register) 
   * @param {number}         mod     Difficulty modifier (bonus or malus)
   * @param {DiceQuantities} dice    An object with quantities of dice
   * @returns {DiceQuantities}
   */
  static modify(yzGame, mod, dice) {
    // Twilight 2000
    if (yzGame === 't2k') {
      const dieTypes = ['d', 'c', 'b', 'a'];

      // Creates a dice pool array and finds the total quantities of each die.
      const pool = Object.entries(dice).reduce((arr, [k, v]) => {
        if (dieTypes.includes(k)) {
          for (; v > 0; v--) arr.push(k);
        }
      }, []);
      const n = pool.length;

      // Exits early on 3+ dice.
      if (n > 2) return dice;
      if (n <= 1 && pool === ['d']) return dice;

      // Initializes null dice.
      for (const type of dieTypes) if (!dice[type]) dice[type] = 0;

      // Gets the die to modify.
      const die = pool.reduce((a, b) => {
        if (mod > 0) {
          if (b === 'a') return a;
          return a > b ? a : b;
        }
        return a < b ? a : b;
      }, '');

      // Exits early if we didn't find a die to change.
      if (!die) return dice;

      // Modifies the range.
      let excess = mod;
      const currentRangeIndex = dieTypes.indexOf(die);
      if (currentRangeIndex >= 0) {
        const maxRangeIndex = dieTypes.length - 1;
        const newRangeIndex = currentRangeIndex + mod;
        const rangeIndex = clampNumber(newRangeIndex, 0, maxRangeIndex);
        const newDie = dieTypes[rangeIndex];
        excess -= (rangeIndex - currentRangeIndex);

        // Positive excess means adding an extra die.
        // Note: the pool can only have a maximum of 2 dice.
        if (excess > 0) {
          dice[die] -= 1;
          dice[newDie] += 1;

          if (n < 2) {
            const ex = Math.min(dieTypes.length, excess);
            const extraDie = dieTypes[ex - 1];
            dice[extraDie] += 1;
            if (excess > ex) YZRoller.modify(yzGame, excess - ex);
          }
          else {
            YZRoller.modify(yzGame, excess, dice);
          }
        }
        // Negative excess means removing the die and decreasing another one.
        // Note: The pool has always 1 die.
        else if (excess < 0 && n > 1) {
          dice[die] -= 1;
          // We add 1 because we removed one die (which is 1 step).
          YZRoller.modify(yzGame, excess + 1, dice);
        }
        else {
          dice[die] -= 1;
          dice[newDie] += 1;
        }
      }
    }
    // Mutant Year Zero & Forbidden Lands
    else if (yzGame === 'myz' || yzGame === 'fbl') {
      if (!dice.skill) dice.skill = 0;
      const neg = Math.max(-mod - dice.skill, 0);
      dice.skill += mod;
      if (neg > 0) {
         if (!dice.neg) dice.neg = 0;
        dice.neg += neg;
      }
    }
    // All other games
    else {
      if (!dice.skill) dice.skill = 0;
      dice.skill += mod;
    }
    return dice;
  }

  /* -------------------------------------------- */

  /**
   * Die Types and their classes.
   * @type {Object<DieTypeString, YearZeroDie>}
   * @constant
   * @readonly
   * @static
   */
  static get DIE_TYPES() {
    // Wrapped like this because of class declarations issues.
    return {
      'base': BaseDie,
      'skill': SkillDie,
      'gear': GearDie,
      'neg': NegativeDie,
      'stress': StressDie,
      'arto': ArtifactDie,
      'artoD8': D8ArtifactDie,
      'artoD10': D10ArtifactDie,
      'artoD12': D12ArtifactDie,
      'a': D6TwilightDie,
      'b': D8TwilightDie,
      'c': D10TwilightDie,
      'd': D12TwilightDie,
      'ammo': AmmoDie,
      'loc': LocationDie,
    };
  }

  /**
   * Die Types mapped with Games.
   * @type {Object<GameTypeString, DieTypeString[]>}
   * @constant
   * @static
   */
  static DIE_TYPES_MAP = {
    // Mutant Year Zero
    'myz': ['base', 'skill', 'gear', 'neg'],
    // Forbidden Lands
    'fbl': ['base', 'skill', 'gear', 'neg', 'artoD8', 'artoD10', 'artoD12'],
    // Alien RPG
    'alien': ['skill', 'stress'],
    // Tales From the Loop
    'tales': ['skill'],
    // Coriolis
    'cor': ['skill'],
    // Vaesen
    'vae': ['skill'],
    // Twilight 2000
    't2k': ['a', 'b', 'c', 'd', 'ammo', 'loc'],
  };

  /**
   * @type {GameTypeString[]}
   * @constant
   * @static
   */
  static GAMES = Object.keys(YZRoller.DIE_TYPES_MAP);
}

/* -------------------------------------------- */
/*  Custom Roll Class                           */
/* -------------------------------------------- */

/**
 * Custom Roll class for Year Zero games.
 * @extends {Roll} The Foundry Roll class
 */
export class YearZeroRoll extends Roll {
  /**
   * @param {string} formula  The string formula to parse
   * @param {Object} data     The data object against which to parse attributes within the formula
   * @param {string} data._id      The ID of the roll
   * @param {string} data.game     The game used
   * @param {number} data.maxPush  The maximum number of times the roll can be pushed
   */
  constructor(formula, data = {}) {
    super(formula, data);

    if (!this.data._id) {
      Object.defineProperty(this.data, '_id', {
        value: randomID(6),
        enumerable: false,
        configurable: false,
        writable: false,
      });
    }
  }

  /**
   * The ID number of the roll.
   * @type {string}
   * @readonly
   * @private
   */
  get _id() {
    return this.data._id;
  }

  /**
   * The game used.
   * @type {string}
   * @readonly
   */
  get game() {
    if (!this.data.game) return YZRoller.GAMES[0];
    return this.data.game;
  }

  /**
   * The total number of dice in the roll.
   * @type {number}
   * @readonly
   */
  get size() {
    return this.terms.reduce((s, t) => t instanceof YearZeroDie ? s + t.number : s, 0);
  }

  /**
   * Whether the roll was pushed or not.
   * @type {boolean}
   * @readonly
   */
  get pushed() {
    return this.data.pushCount > 0;
  }

  /**
   * Tells if the roll is pushable.
   * @type {boolean}
   * @readonly
   */
  get pushable() {
    return (
      this.data.pushCount < this.data.maxPush
      && this.terms.some(t => t.pushable)
      && !this.mishap
    );
  }

  /**
   * The quantity of successes.
   * @type {number}
   * @readonly
   * @deprecated
   */
  get successCount() {
    console.warn('YZRoll | YearZeroRoll#successCount is deprecated. Use #total instead.')
    return this.total;
  }

  /**
   * The quantity of ones (banes).
   * @type {number}
   * @readonly
   */
  get baneCount() {
    const banableTypes = ['base', 'gear', 'stress', 'ammo'];
    let count = 0;
    for (const bt of banableTypes) {
      count += this.count(bt, 1);
    }
    return count;
  }

  /**
   * The quantity of traumas ("1" on base dice).
   * @type {number}
   * @readonly
   */
  get attributeTrauma() {
    return this.count('base', 1);
  }

  /**
   * The quantity of gear damage ("1" on gear dice).
   * @type {number}
   * @readonly
   */
  get gearDamage() {
    return this.count('gear', 1);
  }

  /**
   * The quantity of stress dice.
   * @type {number}
   * @readonly
   */
  get stress() {
    return this.count('stress');
  }

  /**
   * The quantity of panic ("1" on stress dice).
   * @type {number}
   * @readonly
   */
  get panic() {
    return this.count('stress', 1);
  }

  /**
   * Tells if the roll is a mishap (double 1's).
   * @type {boolean}
   * @readonly
   */
  get mishap() {
    if (this.game !== 't2k') return false;
    return this.baneCount >= 2 || this.baneCount >= this.size;
  }

  /** @override */
  roll() {
    super.roll();
    YearZeroRollManager.cache(this);
    return this;
  }

  /**
   * Pushes the roll, following the YZ rules.
   * @returns {YearZeroRoll} This roll, pushed
   */
  push() {
    if (!this.pushable) return this;

    // Step 1 — Pushes the terms.
    this.terms.forEach(t => t.pushable ? t.push() : t);

    // Step 2 — Evaluates terms.
    // Note: t.evaluate() = term, otherwise = operation sign
    this.results = this.terms.map(t => t.evaluate ? t.total : t);

    // Step 3 — Safely evaluates the final total.
    let total = this._safeEval(this.results.join(" "));
    if ( total === null ) total = 0;
    if ( !Number.isNumeric(total) ) {
      throw new Error(game.i18n.format("DICE.ErrorNonNumeric", {formula: this.formula}));
    }

    // Stores the final output.
    this._dice = []; // TODO
    this._total = total;
    YearZeroRollManager.cache(this);
  }

  /**
   * Gets all the dice terms of a certain type.
   * @param {DieTypeString} type Die type to search
   * @returns {DiceTerm[]}
   */
  getTerms(type) {
    // const cls = DIE_TYPES[type];
    // if (!cls) throw new TypeError(`Year Zero Roll | Die type unknown: "${type}".`);
    return this.terms.filter(t => t.type === type);
  }

  /**
   * Counts the values of a certain type in the roll.
   * If `seed` is omitted, counts all the dice of a certain type.
   * @param {DieTypeString} type The type of the die
   * @param {number} seed The number to search, if any
   * @returns {number} Total count
   */
  count(type, seed) {
    if (seed != null) {
      return this.terms.reduce((c, t) => {
        if (t.type !== type) return c;
        for (const r of t.results) {
          if (!r.active) continue;
          if (r.result === seed) c++;
        }
        return c;
      }, 0);

    }
    return this.terms.reduce((c, t) => t.type === type ? c + t.number : c, 0);
    // return this.getTerms(type).reduce((c, t) => c + t.number, 0);
  }

  /**
   * Renders the tooltip HTML for a Roll instance.
   * @return {Promise<HTMLElement>}
   * @override
   * @async
   */
  getTooltip() {
    const parts = this.dice.map(d => {
      const cls = d.constructor;
      return {
      formula: d.formula,
      total: d.total,
      faces: d.faces,
      flavor: d.options.flavor,
      rolls: d.results.map(r => {
        const hasSuccess = r.success !== undefined;
        const hasFailure = r.failure !== undefined;
        // START MODIFIED PART ==>
        // // const isMax = r.result === d.faces;
        // // const isMin = r.result === 1;
        let isMax = false, isMin = false;
        if (d.type === 'neg') {
          isMax = false;
          isMin = r.result === 6;
        }
        else {
          isMax = r.result === d.faces || r.count >= 1;
          isMin = r.result === 1 && d.type !== 'skill' && d.type !== 'loc';
        }
        // <== END MODIFIED PART
        return {
        result: cls.getResultLabel(r.result),
        classes: [
          cls.name.toLowerCase(),
          "d" + d.faces,
          r.success ? "success" : null,
          r.failure ? "failure" : null,
          r.rerolled ? "rerolled" : null,
          r.exploded ? "exploded" : null,
          r.discarded ? "discarded" : null,
          !(hasSuccess || hasFailure) && isMin ? "min" : null,
          !(hasSuccess || hasFailure) && isMax ? "max" : null
        ].filter(c => c).join(" ")
        }
      })
      };
    });
    return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts });
  }
}

/* -------------------------------------------- */
/*  Custom Dice classes                         */
/* -------------------------------------------- */

export class YearZeroDie extends Die {
  constructor(termData) {
    termData.faces = termData.faces || 6;
    super(termData);

    // if (!this.options.flavor) {
    //   const clsName = this.constructor.name;
    //   this.options.flavor = game.i18n.localize(`YZDIE.${clsName}`);
    // }
  }

  /**
   * The type of the die.
   * @abstract Must be implemented by other dice.
   * @type {DieTypeString}
   * @readonly
   */
  get type() {
    return undefined;
  }

  /**
   * Whether the die can be pushed (according to its type).
   * @type {boolean}
   * @readonly
   */
  get pushable() {
    for (const r of this.results) {
      if (!r.active || r.discarded) continue;
      if (!this.constructor.LOCKED_VALUES.includes(r.result)) {
        return true;
      }
    }
    return true;
  }

  /**
   * Number of times this die has been pushed.
   * @type {number}
   * @readonly
   */
  get pushCount() {
    return this.results.reduce((c, r) => c + (r.pushed ? 1 : 0), 0);
  }

  /**
   * Whether this die has been pushed.
   * @type {boolean}
   * @readonly
   */
  get pushed() {
    return this.pushCount > 0;
  }
  
  /** @override */
  roll(options) {
    const roll = super.roll(options);
    roll.count = roll.result >= 6 ? 1 : 0;
    this.results[this.results.length - 1] = roll;
    return roll;
  }

  count(n) {
    return this.values.filter(v => v === n).length;
  }

  push() {
    let count = 0;
    for (const r of this.results) {
      if (!r.active) continue;
      if (!this.constructor.LOCKED_VALUES.includes(r.result)) {
        r.active = false;
        r.discarded = true;
        r.pushed = true;
        count++;
      }
    }
    for (; count > 0; count--) this.roll();
    return this;
  }

  /** @override */
  static getResultLabel(result) {
    if (result === 1) return '☣';
    if (result === 6) return '☢';
    return result;
  }

  static LOCKED_VALUES = [6];
  static MODIFIERS = mergeObject(
    { 'p' : 'push' },
    Die.MODIFIERS,
  );
}

/**
 * Base Die: 1 & 6 cannot be re-rolled.
 * @extends {YearZeroDie}
 */
export class BaseDie extends YearZeroDie {
  get type() { return 'base'; }
  static DENOMINATION = 'b';
  static LOCKED_VALUES = [1, 6];
}

/**
 * Skill Die: 6 cannot be re-rolled.
 * @extends {YearZeroDie}
 */
export class SkillDie extends YearZeroDie {
  get type() { return 'skill'; }
  static DENOMINATION = 's';
  /** @override */
  static getResultLabel(result) {
    return result >= 6 ? '☢' : result;
  }
}

/**
 * Gear Die: 1 & 6 cannot be re-rolled.
 * @extends {YearZeroDie}
 */
export class GearDie extends YearZeroDie {
  get type() { return 'gear'; }
  /** @override */
  static getResultLabel(result) {
    if (result === 1) return '💥';
    if (result === 6) return '☢';
    return result;
  }
  static DENOMINATION = 'g';
  static LOCKED_VALUES = [1, 6];
}

/**
 * Negative Die: 6 cannot be re-rolled.
 * @extends {SkillDie}
 */
export class NegativeDie extends SkillDie {
  get type() { return 'neg'; }
  /** @override */
  roll(options) {
    const roll = super.roll(options);
    roll.count = roll.result >= 6 ? -1 : 0;
    this.results[this.results.length - 1] = roll;
    return roll;
  }
  static DENOMINATION = 'n';
}

/* -------------------------------------------- */

/**
 * Stress Die: 1 & 6 cannot be re-rolled.
 * @extends {YearZeroDie}
 */
export class StressDie extends YearZeroDie {
  get type() { return 'stress'; }
  static DENOMINATION = 's';
  static LOCKED_VALUES = [1, 6];
  /** @override */
  static getResultLabel(result) {
    if (result >= 6) return '✔️';
    if (result === 1) return '⚠️';
    return result;
  }
}

/* -------------------------------------------- */

/**
 * Artifact Die: 6+ cannot be re-rolled.
 * @extends {SkillDie}
 */
export class ArtifactDie extends SkillDie {
  get type() { return 'arto'; }
  /** @override */
  roll(options) {
    const roll = super.roll(options);
    if (roll.result < this.constructor.SUCCESS_TABLE.length) {
      roll.count = this.constructor.SUCCESS_TABLE[roll.result];
    }
    this.results[this.results.length - 1] = roll;
    return roll;
  }
  /** @override */
  static getResultLabel(result) {
    return result;
    // TODO
    if (result >= 6 && result < ArtifactDie.SUCCESS_TABLE.length) {
      const n = ArtifactDie.SUCCESS_TABLE[result];
      return '•'.repeat(n); //⚔️
    }
    return result;
  }
  static SUCCESS_TABLE = [null, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4];
  static LOCKED_VALUES = [6, 7, 8, 9, 10, 11, 12];
}

export class D8ArtifactDie extends ArtifactDie {
  constructor(termData) {
    termData.faces = 8;
    super(termData);
  }
  static DENOMINATION = '8';
}

export class D10ArtifactDie extends ArtifactDie {
  constructor(termData) {
    termData.faces = 10;
    super(termData);
  }
  static DENOMINATION = '10';
}

export class D12ArtifactDie extends ArtifactDie {
  constructor(termData) {
    termData.faces = 12;
    super(termData);
  }
  static DENOMINATION = '12';
}

/* -------------------------------------------- */

/**
 * Twilight Die: 1 & 6+ cannot be re-rolled.
 * @extends {ArtifactDie} But LOCKED_VALUES is not the same
 */
export class TwilightDie extends ArtifactDie {
  get type() { return 'base' }
  /** @override */
  static getResultLabel(result) {
    if (result === 1) return '•';
    return result;
  }
  static SUCCESS_TABLE = [null, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
  static LOCKED_VALUES = [1, 6, 7, 8, 9, 10, 11, 12];
}

export class D6TwilightDie extends TwilightDie {
  constructor(termData) {
    termData.faces = 6;
    super(termData);
  }
  static DENOMINATION = 'd';
}

export class D8TwilightDie extends TwilightDie {
  constructor(termData) {
    termData.faces = 8;
    super(termData);
  }
  static DENOMINATION = 'c';
}

export class D10TwilightDie extends TwilightDie {
  constructor(termData) {
    termData.faces = 10;
    super(termData);
  }
  static DENOMINATION = 'b';
}

export class D12TwilightDie extends TwilightDie {
  constructor(termData) {
    termData.faces = 12;
    super(termData);
  }
  static DENOMINATION = 'a';
}

/* -------------------------------------------- */

export class AmmoDie extends YearZeroDie {
  constructor(termData) {
    termData.faces = 6;
    super(termData);
  }
  get type() { return 'ammo' }
  get hit() { return this.count(6)}
  static DENOMINATION = 'm';
  static LOCKED_VALUES = [];
  /** @override */
  static getResultLabel(result) {
    if (result === 1) return '•';
    if (result >= 6) return '🎯';
    return result;
  }
}

export class LocationDie extends Die {
  constructor(termData) {
    termData.faces = 6;
    super(termData);
  }
  get type() { return 'loc' }
  /** @override */
  roll(options) {
    const roll = super.roll(options);
    roll.count = 0;
    this.results[this.results.length - 1] = roll;
    return roll;
  }
  /** @override */
  static getResultLabel(result) {
    return {
      '1': 'L',
      '2': 'T', '3': 'T', '4': 'T',
      '5': 'A',
      '6': 'H',
    }[result];
  }
  static DENOMINATION = 'l';
}

/* -------------------------------------------- */
/*  Custom Errors                               */
/* -------------------------------------------- */

class GameTypeError extends TypeError {
  constructor(msg) {
    super(`Unknown game: "${msg}". Allowed games are: ${YZRoller.GAMES.join(', ')}.`);
    this.name = 'YZ GameType Error';
  }
}

class DieTypeError extends TypeError {
  constructor(msg) {
    super(`Unknown die type: "${msg}". Allowed types are: ${Object.keys(YZRoller.DIE_TYPES).join(', ')}.`);
    this.name = 'YZ DieType Error';
  }
}