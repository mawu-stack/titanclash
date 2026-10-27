/* =============================================================================
   TITAN CLASH 3D - HEADLESS AUTHORITATIVE SERVER COMBAT SIMULATOR
   Zero WebGL/DOM dependencies. Controls positions, collisions, damage,
   stamina, cooldowns, ultimate meters, projectiles, props, and round states.
   ============================================================================= */

import * as THREE from './three.module.js';
import { CHARACTER_ROSTER } from './characters.js';

export class ServerCombatMatch {
  constructor(matchId, p1CharId = 'gipsy', p2CharId = 'leatherback', options = {}) {
    this.matchId = matchId;
    this.tick = 0;
    this.gameState = 'countdown'; // 'countdown' | 'fighting' | 'finisher_cinematic' | 'abyssal_beam' | 'reactor_overdrive' | 'round_over' | 'match_over' | 'paused_disconnect'
    this.previousStateBeforeDisconnect = null;
    this.countdownTimer = 3.0;
    this.roundDuration = 90.0;
    this.roundTimer = this.roundDuration;
    this.currentRound = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.targetWins = 2;
    this.roundTransitionTimer = 0;
    this.targetTransitionCallback = null;

    // Arena bounds
    this.bounds = {
      shorelineZ: -36.0,
      landwardZ: 205.0,
      flankMinX: -285.0,
      flankMaxX: 285.0
    };

    // Instantiate authoritative arena
    this.initArena();

    // Instantiate authoritative fighters
    this.p1 = this.createFighter('p1', p1CharId, -65, 0, Math.PI / 2);
    this.p2 = this.createFighter('p2', p2CharId, 65, 0, -Math.PI / 2);
    this.p1.opponent = this.p2;
    this.p2.opponent = this.p1;

    // Input queues
    this.inputQueues = {
      p1: [],
      p2: []
    };

    // Active projectiles & transient events
    this.projectiles = [];
    this.projectileCounter = 0;
    this.events = [];

    // Cinematics & Ultimates
    this.abyssalBeamData = null;
    this.reactorOverdriveData = null;
    this.finisherData = null;
  }

  initArena() {
    // 6 Perimeter Destructible Buildings
    this.buildings = [
      { id: 'building_0', x: -140, z: 15, width: 38, depth: 38, height: 95, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: true },
      { id: 'building_1', x: 140, z: 15, width: 38, depth: 38, height: 95, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: false },
      { id: 'building_2', x: -110, z: 80, width: 36, depth: 36, height: 90, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: false },
      { id: 'building_3', x: 110, z: 80, width: 36, depth: 36, height: 90, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: true },
      { id: 'building_4', x: -180, z: -10, width: 34, depth: 34, height: 80, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: false },
      { id: 'building_5', x: 180, z: -10, width: 34, depth: 34, height: 80, radius: 22, health: 300, maxHealth: 300, destroyed: false, isFinisher: false }
    ];

    // 8 Environmental Throwable Props
    this.props = [
      { id: 'prop_0', type: 'container', x: -65, z: -25, y: 4, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 110, radius: 12, active: true, safeTimer: 0 },
      { id: 'prop_1', type: 'container', x: 65, z: -25, y: 4, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 110, radius: 12, active: true, safeTimer: 0 },
      { id: 'prop_2', type: 'container', x: -50, z: 24, y: 4, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 110, radius: 12, active: true, safeTimer: 0 },
      { id: 'prop_3', type: 'container', x: 50, z: 24, y: 4, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 110, radius: 12, active: true, safeTimer: 0 },
      { id: 'prop_4', type: 'truck', x: -85, z: 12, y: 3.5, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 130, radius: 10, active: true, safeTimer: 0 },
      { id: 'prop_5', type: 'truck', x: 85, z: 12, y: 3.5, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 130, radius: 10, active: true, safeTimer: 0 },
      { id: 'prop_6', type: 'tanker', x: 0, z: -26, y: 5.5, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 150, radius: 11, active: true, safeTimer: 0 },
      { id: 'prop_7', type: 'rubble', x: 0, z: 26, y: 4.5, vx: 0, vz: 0, vy: 0, isHeld: false, holder: null, isThrown: false, damage: 95, radius: 9, active: true, safeTimer: 0 }
    ];
  }

  createFighter(slot, charId, startX, startZ, startRotY) {
    const cfg = CHARACTER_ROSTER[charId] || CHARACTER_ROSTER['gipsy'];
    return {
      slot,
      charId,
      config: cfg,
      x: startX,
      z: startZ,
      y: 0,
      rotationY: startRotY,
      vx: 0,
      vz: 0,
      health: cfg.maxHealth,
      maxHealth: cfg.maxHealth,
      stamina: cfg.maxStamina,
      maxStamina: cfg.maxStamina,
      staminaRegen: cfg.staminaRegenRate,
      ultimateMeter: 0,
      maxUltimate: 100,
      state: 'idle',
      stateTimer: 0,
      stateDuration: 0,
      currentAttack: null,
      hasDealtDamage: false,
      comboCounter: 0,
      comboWindowTimer: 0,
      isParryActive: false,
      parryTimer: 0,
      counterOpportunity: false,
      counterOpportunityTimer: 0,
      counterWindowTimer: 0,
      counterCooldownTimer: 0,
      specialCooldownTimer: 0,
      throwCooldownTimer: 0,
      sharedPowerRecoveryTimer: 0,
      heldObject: null,
      pendingPickupProp: null,
      invulnerableTimer: 0,
      hitStunTimer: 0,
      consecutiveHitsTaken: 0,
      lastHitTime: 0,
      lastProcessedSeq: 0,
      hurtboxRadius: (cfg.id === 'leatherback' ? 19.5 : 16.0),
      height: cfg.height || 79
    };
  }

  resetFighter(f, startX, startZ, startRotY) {
    f.x = startX;
    f.z = startZ;
    f.y = 0;
    f.rotationY = startRotY;
    f.vx = 0;
    f.vz = 0;
    f.health = f.maxHealth;
    f.stamina = f.maxStamina;
    f.ultimateMeter = 0;
    f.state = 'idle';
    f.stateTimer = 0;
    f.stateDuration = 0;
    f.currentAttack = null;
    f.hasDealtDamage = false;
    f.comboCounter = 0;
    f.comboWindowTimer = 0;
    f.isParryActive = false;
    f.parryTimer = 0;
    f.counterOpportunity = false;
    f.counterOpportunityTimer = 0;
    f.counterWindowTimer = 0;
    f.counterCooldownTimer = 0;
    f.specialCooldownTimer = 0;
    f.throwCooldownTimer = 0;
    f.sharedPowerRecoveryTimer = 0;
    f.heldObject = null;
    f.pendingPickupProp = null;
    f.invulnerableTimer = 0;
    f.hitStunTimer = 0;
    f.consecutiveHitsTaken = 0;
  }

  enqueueInput(slot, input) {
    if (this.inputQueues[slot]) {
      this.inputQueues[slot].push(input);
    }
  }

  update(dt) {
    this.tick++;
    this.events = [];

    // Pause handling during disconnect grace window
    if (this.gameState === 'paused_disconnect') {
      return;
    }

    // Countdown before round starts
    if (this.gameState === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.gameState = 'fighting';
        this.events.push({ type: 'announcement', title: `ROUND ${this.currentRound}`, sub: 'FIGHT!', duration: 1.5 });
      }
      return;
    }

    // Transition timers (between rounds or match over)
    if (this.roundTransitionTimer > 0) {
      this.roundTransitionTimer -= dt;
      if (this.roundTransitionTimer <= 0 && this.targetTransitionCallback) {
        const cb = this.targetTransitionCallback;
        this.targetTransitionCallback = null;
        cb();
      }
    }

    // 1. Process Queued Client Inputs for both slots
    this.processFighterInputs('p1', dt);
    this.processFighterInputs('p2', dt);

    // 2. Active Combat Updates
    if (this.gameState === 'fighting') {
      this.roundTimer -= dt;
      if (this.roundTimer <= 0) {
        // Timeout resolution
        const p1Pct = this.p1.health / this.p1.maxHealth;
        const p2Pct = this.p2.health / this.p2.maxHealth;
        if (p1Pct > p2Pct) this.endRound('p1');
        else if (p2Pct > p1Pct) this.endRound('p2');
        else this.endRound('draw');
      }

      // Check KO conditions
      if (this.p1.health <= 0) {
        this.endRound('p2');
      } else if (this.p2.health <= 0) {
        this.endRound('p1');
      }

      this.resolveFighterCollisions();
      this.checkFighterBuildingCollisions(this.p1);
      this.checkFighterBuildingCollisions(this.p2);
      this.updateProjectiles(dt);
      this.updateEnvironmentalProps(dt);
    }

    // 3. Fighter Timers & State Machine Progression
    if (this.gameState === 'fighting' || this.gameState === 'finisher_cinematic' || this.gameState === 'abyssal_beam' || this.gameState === 'reactor_overdrive' || this.gameState === 'round_over') {
      this.updateFighterState(this.p1, dt);
      this.updateFighterState(this.p2, dt);
    }

    // 4. Ultimates & Cinematics
    if (this.gameState === 'abyssal_beam') {
      this.updateAbyssalBeam(dt);
      this.updateProjectiles(dt);
    } else if (this.gameState === 'reactor_overdrive') {
      this.updateReactorOverdrive(dt);
      this.updateProjectiles(dt);
    } else if (this.gameState === 'finisher_cinematic') {
      this.updateFinisherCinematic(dt);
      this.updateProjectiles(dt);
    }
  }

  processFighterInputs(slot, dt) {
    const f = slot === 'p1' ? this.p1 : this.p2;
    const queue = this.inputQueues[slot];
    if (!queue || queue.length === 0) return;

    // Check if fighter is defender during an ultimate's escape window
    const isDefenderDuringBeam = (this.gameState === 'abyssal_beam' && this.abyssalBeamData && f.slot === this.abyssalBeamData.targetSlot);
    const isDefenderDuringOverdrive = (this.gameState === 'reactor_overdrive' && this.reactorOverdriveData && f.slot === this.reactorOverdriveData.targetSlot);

    // Process all pending input packets up to latest
    while (queue.length > 0) {
      const input = queue.shift();
      f.lastProcessedSeq = input.seq;

      if (this.gameState !== 'fighting' && !isDefenderDuringBeam && !isDefenderDuringOverdrive) continue;
      if (!this.canAct(f) && f.state !== 'blocking' && !isDefenderDuringBeam && !isDefenderDuringOverdrive) continue;

      // Movement Input (camera-relative)
      if ((this.canAct(f) || isDefenderDuringBeam || isDefenderDuringOverdrive) && f.state !== 'blocking') {
        const camAngle = input.camAngle || 0;
        const camForwardX = -Math.sin(camAngle);
        const camForwardZ = -Math.cos(camAngle);
        const camRightX = Math.cos(camAngle);
        const camRightZ = -Math.sin(camAngle);

        const worldMoveX = camRightX * input.moveX + camForwardX * input.moveZ;
        const worldMoveZ = camRightZ * input.moveX + camForwardZ * input.moveZ;

        const moveLenSq = worldMoveX * worldMoveX + worldMoveZ * worldMoveZ;
        if (moveLenSq > 0.001) {
          const moveLen = Math.sqrt(moveLenSq);
          const nx = worldMoveX / moveLen;
          const nz = worldMoveZ / moveLen;
          const targetVx = nx * f.config.moveSpeed;
          const targetVz = nz * f.config.moveSpeed;
          const accelRate = 12.0;
          f.vx += (targetVx - f.vx) * (1.0 - Math.exp(-accelRate * dt));
          f.vz += (targetVz - f.vz) * (1.0 - Math.exp(-accelRate * dt));

          if (f.state === 'idle') f.state = 'moving';
        } else {
          if (f.state === 'moving') f.state = 'idle';
        }
      }

      // Action Input
      if (input.action) {
        if (this.gameState !== 'fighting' && (isDefenderDuringBeam || isDefenderDuringOverdrive)) {
          if (input.action === 'dodge') {
            this.executeFighterAction(f, input.action, input);
          }
        } else {
          this.executeFighterAction(f, input.action, input);
        }
      }
    }
  }

  canAct(f) {
    if (f.state === 'ko' || f.state === 'hurt' || f.state === 'ultimate_abyssal_beam' || f.state === 'ultimate_reactor_overdrive' || f.state === 'cinematic') return false;
    if (f.state === 'throw_recovery' || f.state === 'throwing_windup' || f.state === 'picking_up') return false;
    return (
      (f.state === 'idle' || f.state === 'moving' || f.state === 'blocking' || f.state === 'holding_object') &&
      f.sharedPowerRecoveryTimer <= 0
    );
  }

  executeFighterAction(f, action, input = {}) {
    const opp = f.opponent;

    // Turn toward opponent on standard attacks/actions (unless dodging during an ultimate escape window)
    if (opp && action !== 'dodge') {
      const dx = opp.x - f.x;
      const dz = opp.z - f.z;
      if (Math.hypot(dx, dz) > 0.1) {
        f.rotationY = Math.atan2(dx, dz);
      }
    }

    // Strictly reject dev shortcuts or unauthorized actions on authoritative server
    if (action && (action.startsWith('dev_') || action.startsWith('debug_'))) {
      return;
    }

    if (action === 'block_start') {
      if (this.canAct(f) && f.stamina >= 10) {
        f.state = 'blocking';
        f.vx = 0;
        f.vz = 0;
        // Timed parry window (250ms)
        f.isParryActive = (f.counterCooldownTimer <= 0);
        f.parryTimer = 0.25;
      }
      return;
    }

    if (action === 'block_stop') {
      if (f.state === 'blocking') {
        f.state = 'idle';
        f.isParryActive = false;
        f.parryTimer = 0;
      }
      return;
    }

    if (action === 'dodge') {
      const isDefender = (this.gameState === 'abyssal_beam' && this.abyssalBeamData && f.slot === this.abyssalBeamData.targetSlot) ||
                         (this.gameState === 'reactor_overdrive' && this.reactorOverdriveData && f.slot === this.reactorOverdriveData.targetSlot);
      if ((this.canAct(f) || isDefender) && f.stamina >= 20) {
        f.stamina -= 20;
        f.state = 'dodging';
        f.stateTimer = 0;
        f.stateDuration = 0.42;

        // Directional dodge: prioritize movement input (WASD + Space)
        const dodgeSpeed = f.config.dodgeSpeed || 70;
        const camAngle = input.camAngle || 0;
        const camForwardX = -Math.sin(camAngle);
        const camForwardZ = -Math.cos(camAngle);
        const camRightX = Math.cos(camAngle);
        const camRightZ = -Math.sin(camAngle);
        const worldMoveX = camRightX * (input.moveX || 0) + camForwardX * (input.moveZ || 0);
        const worldMoveZ = camRightZ * (input.moveX || 0) + camForwardZ * (input.moveZ || 0);
        const moveLen = Math.hypot(worldMoveX, worldMoveZ);

        if (moveLen > 0.01) {
          f.vx = (worldMoveX / moveLen) * dodgeSpeed;
          f.vz = (worldMoveZ / moveLen) * dodgeSpeed;
        } else {
          // Default backstep away from opponent
          if (opp) {
            const dx = f.x - opp.x;
            const dz = f.z - opp.z;
            const dist = Math.hypot(dx, dz) || 1;
            f.vx = (dx / dist) * dodgeSpeed;
            f.vz = (dz / dist) * dodgeSpeed;
          } else {
            f.vx = -Math.sin(f.rotationY) * dodgeSpeed;
            f.vz = -Math.cos(f.rotationY) * dodgeSpeed;
          }
        }
      }
      return;
    }

    if (action === 'interact' || action === 'ultimate') {
      this.attemptInteraction(f);
      return;
    }

    if (action === 'light') {
      if (f.heldObject) {
        this.throwHeldObject(f);
        return;
      }
      // Counter execution
      if (f.counterWindowTimer > 0 && this.canAct(f)) {
        this.startAttack(f, 'counter', f.config.attacks.counter);
        f.counterWindowTimer = 0;
        return;
      }
      // Light combo progression
      if (f.comboWindowTimer > 0 && f.comboCounter === 1 && f.config.attacks.light2) {
        this.startAttack(f, 'light2', f.config.attacks.light2);
        f.comboCounter = 2;
        f.comboWindowTimer = 0.55;
      } else {
        this.startAttack(f, 'light', f.config.attacks.light);
        f.comboCounter = 1;
        f.comboWindowTimer = 0.55;
      }
      return;
    }

    if (action === 'heavy') {
      if (f.heldObject) {
        this.throwHeldObject(f);
        return;
      }
      if (f.counterWindowTimer > 0 && this.canAct(f)) {
        this.startAttack(f, 'counter', f.config.attacks.counter);
        f.counterWindowTimer = 0;
        return;
      }
      this.startAttack(f, 'heavy', f.config.attacks.heavy);
      return;
    }

    if (action === 'comboFinisher') {
      if (f.config.attacks.comboFinisher && this.canAct(f) && f.stamina >= f.config.attacks.comboFinisher.staminaCost) {
        this.startAttack(f, 'comboFinisher', f.config.attacks.comboFinisher);
      }
      return;
    }

    if (action === 'special') {
      this.executeSpecial(f);
      return;
    }
  }

  startAttack(f, attackKey, atkData) {
    if (!atkData || !this.canAct(f)) return false;
    if (f.stamina < atkData.staminaCost) {
      this.events.push({ type: 'ability_feedback', slot: f.slot, text: 'STAMINA DEPLETED' });
      return false;
    }

    f.stamina -= atkData.staminaCost;
    f.currentAttack = atkData;
    f.state = `attack_${attackKey}`;
    f.stateTimer = 0;
    f.stateDuration = atkData.windup + atkData.activeDuration + atkData.recovery;
    f.hasDealtDamage = false;

    // Lunging forward impulse with close-range overlap prevention
    const forwardX = Math.sin(f.rotationY);
    const forwardZ = Math.cos(f.rotationY);
    const lungeImpulse = (attackKey === 'counter') ? 40 : (attackKey === 'heavy' ? 26 : 16);
    
    // Check distance to opponent to prevent ramming into their mesh at close range
    const distToOpp = f.opponent ? Math.hypot(f.opponent.x - f.x, f.opponent.z - f.z) : 999;
    const minDist = f.hurtboxRadius + (f.opponent ? f.opponent.hurtboxRadius : 16.0) + 8.5;
    if (distToOpp > minDist) {
      const maxLunge = Math.min(lungeImpulse, (distToOpp - minDist) * 10.0);
      f.vx += forwardX * maxLunge;
      f.vz += forwardZ * maxLunge;
    }

    this.events.push({ type: 'attack_started', slot: f.slot, attackKey, animationType: atkData.animationType });
    return true;
  }

  executeSpecial(f) {
    const special = f.config.attacks.special;
    if (!special || !this.canAct(f)) return false;

    if (f.specialCooldownTimer > 0) {
      this.events.push({ type: 'ability_feedback', slot: f.slot, text: `SPECIAL COOLDOWN (${f.specialCooldownTimer.toFixed(1)}s)` });
      return false;
    }
    if (f.stamina < special.staminaCost) {
      this.events.push({ type: 'ability_feedback', slot: f.slot, text: 'STAMINA INSUFFICIENT' });
      return false;
    }

    f.stamina -= special.staminaCost;
    f.specialCooldownTimer = special.cooldown || 8.0;
    f.sharedPowerRecoveryTimer = 2.0;
    f.state = 'attack_special';
    f.stateTimer = 0;
    f.stateDuration = special.windup + special.activeDuration + special.recovery;
    f.currentAttack = special;
    f.hasDealtDamage = false;

    this.events.push({ type: 'special_started', slot: f.slot, charId: f.charId });
    return true;
  }

  attemptInteraction(f) {
    if (!this.canAct(f)) return;

    // 1. If currently holding object, hurl it!
    if (f.heldObject) {
      this.throwHeldObject(f);
      return;
    }

    // 2. Leatherback Abyssal Beam
    if (f.charId === 'leatherback') {
      if (f.ultimateMeter >= 100) {
        this.triggerAbyssalBeam(f);
        return;
      } else {
        // Check for environmental prop pickup
        if (this.checkPropPickup(f)) return;
        this.events.push({ type: 'ability_feedback', slot: f.slot, text: `[F] ABYSSAL BEAM NOT READY (${Math.floor(f.ultimateMeter)}%)` });
        return;
      }
    } else {
      // 3. Gipsy Danger Seismic Lance (Skyscraper Finisher)
      if (f.ultimateMeter >= 100) {
        let nearbyFinisherTower = null;
        for (const b of this.buildings) {
          if (b.isFinisher && !b.destroyed && !b.isConsumed) {
            const dist = Math.hypot(b.x - f.x, b.z - f.z);
            if (dist < 65) {
              nearbyFinisherTower = b;
              break;
            }
          }
        }

        if (nearbyFinisherTower) {
          nearbyFinisherTower.isConsumed = true;
          this.triggerSkyscraperFinisher(nearbyFinisherTower, f);
          return;
        } else {
          // When required tower is destroyed, unavailable, or outside practical activation reach, offer Reactor Overdrive
          this.triggerReactorOverdrive(f);
          return;
        }
      } else {
        if (this.checkPropPickup(f)) return;
        this.events.push({ type: 'ability_feedback', slot: f.slot, text: `[F] ULTIMATE METER NOT FULL (${Math.floor(f.ultimateMeter)}%)` });
        return;
      }
    }
  }

  checkPropPickup(f) {
    if (f.heldObject || f.state === 'picking_up') return false;
    for (const prop of this.props) {
      if (prop.active && !prop.isHeld && !prop.isThrown) {
        const dist = Math.hypot(prop.x - f.x, prop.z - f.z);
        if (dist < 36) {
          f.state = 'picking_up';
          f.stateTimer = 0;
          f.stateDuration = 0.55;
          f.pendingPickupProp = prop;
          prop.isHeld = true;
          prop.holder = f.slot;
          this.events.push({ type: 'prop_pickup_start', slot: f.slot, propId: prop.id });
          return true;
        }
      }
    }
    return false;
  }

  throwHeldObject(f) {
    const prop = f.heldObject;
    if (!prop) return;

    f.heldObject = null;
    f.state = 'throw_recovery';
    f.stateTimer = 0;
    f.stateDuration = 0.45;
    f.throwCooldownTimer = 6.0;
    f.sharedPowerRecoveryTimer = 2.0;

    const opp = f.opponent;
    let throwDirX = Math.sin(f.rotationY);
    let throwDirZ = Math.cos(f.rotationY);
    if (opp) {
      const dx = opp.x - f.x;
      const dz = opp.z - f.z;
      const dLen = Math.hypot(dx, dz);
      if (dLen > 0.01) {
        throwDirX = dx / dLen;
        throwDirZ = dz / dLen;
      }
    }

    prop.isHeld = false;
    prop.isThrown = true;
    prop.holder = null;
    prop.thrower = f.slot;
    prop.safeTimer = 0.35;
    prop.vx = throwDirX * 150;
    prop.vz = throwDirZ * 150;

    this.events.push({
      type: 'prop_thrown',
      propId: prop.id,
      x: f.x + throwDirX * 18,
      z: f.z + throwDirZ * 18,
      vx: prop.vx,
      vz: prop.vz
    });
  }

  triggerAbyssalBeam(attacker) {
    if (this.gameState === 'finisher_cinematic' || this.abyssalBeamData || this.reactorOverdriveData) return;
    this.gameState = 'abyssal_beam';
    const target = attacker.opponent;

    attacker.ultimateMeter = 0;
    attacker.state = 'ultimate_abyssal_beam';
    attacker.stateTimer = 0;
    attacker.stateDuration = 3.60;
    attacker.vx = 0;
    attacker.vz = 0;

    this.abyssalBeamData = {
      attackerSlot: attacker.slot,
      targetSlot: target.slot,
      timer: 0,
      windupDuration: 0.70,
      aimLockTime: 0.70,
      firingDuration: 1.40,
      recoveryDuration: 0.80,
      totalDuration: 3.60,
      maxWatchdog: 4.20,
      aimLocked: false,
      lockedDirX: Math.sin(attacker.rotationY),
      lockedDirZ: Math.cos(attacker.rotationY),
      damageAccumulated: 0,
      maxDamage: 450,
      damageInterval: 0.22,
      damageTimer: 0.22,
      damagedBuildings: new Set()
    };

    this.events.push({ type: 'announcement', title: 'ABYSSAL BEAM!', sub: `${attacker.config.name} CHARGES ATOMIC MOUTH BEAM!`, duration: 1.3 });
    this.events.push({ type: 'beam_charge', slot: attacker.slot });
    this.events.push({ type: 'abyssal_beam_started', slot: attacker.slot });
  }

  updateAbyssalBeam(dt) {
    if (!this.abyssalBeamData) return;
    const data = this.abyssalBeamData;
    data.timer += dt;
    const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
    const target = data.targetSlot === 'p1' ? this.p1 : this.p2;
    attacker.stateTimer = data.timer;

    // Failsafe watchdog (4.20s max duration)
    if (data.timer >= (data.maxWatchdog || 4.20)) {
      this.cleanupAbyssalBeam();
      if (target && target.health <= 0) this.endRound(attacker.slot);
      else this.gameState = 'fighting';
      return;
    }

    // Phase 1: Charge (0.0s to 0.70s tracking) & Aim Lock (0.70s to 1.40s escape window)
    if (data.timer < (data.windupDuration + 0.70)) {
      if (data.timer < data.windupDuration) {
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        if (Math.hypot(dx, dz) > 0.1) {
          const desiredAngle = Math.atan2(dx, dz);
          attacker.rotationY += (desiredAngle - attacker.rotationY) * (1.0 - Math.exp(-8.0 * dt));
        }
      } else if (!data.aimLocked) {
        data.aimLocked = true;
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        const dist = Math.hypot(dx, dz);
        data.lockedDirX = dist > 0.01 ? (dx / dist) : Math.sin(attacker.rotationY);
        data.lockedDirZ = dist > 0.01 ? (dz / dist) : Math.cos(attacker.rotationY);

        this.events.push({ type: 'beam_locked', slot: attacker.slot, lockedDirX: data.lockedDirX, lockedDirZ: data.lockedDirZ });
        this.events.push({ type: 'announcement', title: 'AIM LOCKED!', sub: 'DODGE SIDEWAYS TO ESCAPE! [WASD + Space]', duration: 0.85 });
      }
    }
    // Phase 2: Active Beam Discharge (1.40s to 2.80s)
    else if (data.timer < (data.windupDuration + 0.70 + data.firingDuration)) {
      const beamLen = 220;
      const beamDirX = data.lockedDirX;
      const beamDirZ = data.lockedDirZ;

      // Project target onto beam axis
      const toTargetX = target.x - attacker.x;
      const toTargetZ = target.z - attacker.z;
      const projDist = toTargetX * beamDirX + toTargetZ * beamDirZ;

      // Check building block
      let blockDist = Infinity;
      for (const b of this.buildings) {
        if (b.destroyed) continue;
        const toBX = b.x - attacker.x;
        const toBZ = b.z - attacker.z;
        const bProj = toBX * beamDirX + toBZ * beamDirZ;
        if (bProj > 0 && bProj < beamLen) {
          const bClosestX = attacker.x + beamDirX * bProj;
          const bClosestZ = attacker.z + beamDirZ * bProj;
          if (Math.hypot(b.x - bClosestX, b.z - bClosestZ) <= (5.5 + b.radius)) {
            if (bProj < blockDist) blockDist = bProj;
            if (!data.damagedBuildings.has(b.id)) {
              data.damagedBuildings.add(b.id);
              this.damageBuilding(b, 150, { x: bClosestX, z: bClosestZ });
            }
          }
        }
      }

      if (projDist > 0 && projDist < beamLen && projDist < blockDist) {
        const closestX = attacker.x + beamDirX * projDist;
        const closestZ = attacker.z + beamDirZ * projDist;
        const distToBeam = Math.hypot(target.x - closestX, target.z - closestZ);
        const effectiveHitRadius = 5.5 + target.hurtboxRadius;

        if (distToBeam <= effectiveHitRadius) {
          data.damageTimer += dt;
          if (data.damageTimer >= data.damageInterval && data.damageAccumulated < data.maxDamage) {
            const tickDmg = Math.min(90, data.maxDamage - data.damageAccumulated);
            data.damageAccumulated += tickDmg;
            data.damageTimer = 0;

            this.applyDamageToFighter(target, tickDmg, 35, 0.40, { x: attacker.x, z: attacker.z }, attacker, 'abyssal_beam', true);
            this.events.push({ type: 'beam_impact', x: closestX, z: closestZ, slot: target.slot });

            if (target.health <= 0) {
              data.timer = Math.max(data.timer, data.windupDuration + 0.70 + data.firingDuration);
            }
          }
        }
      }
    }
    // Phase 3: Recovery (2.80s to 3.60s)
    else if (data.timer < data.totalDuration) {
      if (target.health <= 0) {
        this.cleanupAbyssalBeam();
        this.endRound(attacker.slot);
        return;
      }
    }
    // Phase 4: Resolution (3.60s+)
    else {
      this.cleanupAbyssalBeam();
      if (target.health <= 0) {
        this.endRound(attacker.slot);
      } else {
        attacker.state = 'idle';
        this.gameState = 'fighting';
      }
    }
  }

  cleanupAbyssalBeam() {
    if (this.abyssalBeamData) {
      const data = this.abyssalBeamData;
      const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
      if (attacker && attacker.state === 'ultimate_abyssal_beam') {
        attacker.state = (attacker.health <= 0) ? 'ko' : 'idle';
      }
      this.abyssalBeamData = null;
    }
  }

  triggerReactorOverdrive(attacker) {
    if (this.gameState === 'finisher_cinematic' || this.abyssalBeamData || this.reactorOverdriveData) return;
    this.gameState = 'reactor_overdrive';
    const target = attacker.opponent;

    attacker.ultimateMeter = 0;
    attacker.state = 'ultimate_reactor_overdrive';
    attacker.stateTimer = 0;
    attacker.stateDuration = 2.80;
    attacker.vx = 0;
    attacker.vz = 0;

    // Face opponent
    const dx = target.x - attacker.x;
    const dz = target.z - attacker.z;
    if (Math.hypot(dx, dz) > 0.1) {
      attacker.rotationY = Math.atan2(dx, dz);
    }

    this.reactorOverdriveData = {
      attackerSlot: attacker.slot,
      targetSlot: target.slot,
      timer: 0,
      slashDealt: false,
      blastDealt: false,
      maxWatchdog: 3.50
    };

    this.events.push({
      type: 'announcement',
      title: 'REACTOR OVERDRIVE!',
      sub: `${attacker.config.name.toUpperCase()} UNLEASHES FULL CORE POWER!`,
      duration: 1.4
    });
    this.events.push({ type: 'reactor_overdrive_started', slot: attacker.slot });
  }

  updateReactorOverdrive(dt) {
    if (!this.reactorOverdriveData) return;
    const data = this.reactorOverdriveData;
    data.timer += dt;
    const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
    const target = data.targetSlot === 'p1' ? this.p1 : this.p2;
    attacker.stateTimer = data.timer;

    // Failsafe watchdog (3.50s max)
    if (data.timer >= (data.maxWatchdog || 3.50)) {
      this.cleanupReactorOverdrive();
      if (target && target.health <= 0) this.endRound(attacker.slot);
      else this.gameState = 'fighting';
      return;
    }

    // Phase 1: Startup & Sword Lunge (0.0s to 0.70s)
    if (data.timer < 0.70) {
      const dx = target.x - attacker.x;
      const dz = target.z - attacker.z;
      if (Math.hypot(dx, dz) > 0.1) {
        const desiredAngle = Math.atan2(dx, dz);
        attacker.rotationY += (desiredAngle - attacker.rotationY) * (1.0 - Math.exp(-8.0 * dt));
      }
    }
    // Phase 2: Twin Chain Sword Heavy Cross-Slash (0.70s to 1.30s)
    else if (data.timer < 1.30) {
      if (!data.slashDealt) {
        data.slashDealt = true;

        // Step forward into melee range
        const fwdX = Math.sin(attacker.rotationY);
        const fwdZ = Math.cos(attacker.rotationY);
        attacker.x += fwdX * 14.0;
        attacker.z += fwdZ * 14.0;
        this.clampToWalkableLand(attacker);

        // Check slash hit (within 44m forward reach)
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        const distToTarget = Math.hypot(dx, dz);
        const dot = (fwdX * dx + fwdZ * dz) / (distToTarget || 1);

        if (distToTarget <= 44.0 && dot > 0.35) {
          this.applyDamageToFighter(target, 220, 8, 0.55, { x: attacker.x, z: attacker.z }, attacker, 'reactor_slash', false);
          this.events.push({ type: 'hit_spark', slot: target.slot, x: target.x, z: target.z, damage: 220, isHeavy: true });
        }
      }
    }
    // Phase 3: Amplified Forearm Plasma Discharge (1.30s to 2.10s)
    else if (data.timer < 2.10) {
      if (!data.blastDealt) {
        data.blastDealt = true;

        const fwdX = Math.sin(attacker.rotationY);
        const fwdZ = Math.cos(attacker.rotationY);
        const dx = target.x - attacker.x;
        const dz = target.z - attacker.z;
        const distToTarget = Math.hypot(dx, dz);
        const dot = (fwdX * dx + fwdZ * dz) / (distToTarget || 1);

        if (distToTarget <= 80.0 && dot > 0.20) {
          this.applyDamageToFighter(target, 260, 55, 0.85, { x: attacker.x, z: attacker.z }, attacker, 'reactor_blast', true);
          this.events.push({ type: 'hit_spark', slot: target.slot, x: target.x, z: target.z, damage: 260, isHeavy: true });
          if (target.health <= 0) {
            data.timer = 2.10;
          }
        }
      }
    }
    // Phase 4: Recovery (2.10s to 2.80s)
    else if (data.timer < 2.80) {
      if (target.health <= 0) {
        this.cleanupReactorOverdrive();
        this.endRound(attacker.slot);
        return;
      }
    }
    // Phase 5: Resolution (2.80s+)
    else {
      this.cleanupReactorOverdrive();
      if (target.health <= 0) {
        this.endRound(attacker.slot);
      } else {
        attacker.state = 'idle';
        this.gameState = 'fighting';
      }
    }
  }

  cleanupReactorOverdrive() {
    if (this.reactorOverdriveData) {
      const data = this.reactorOverdriveData;
      const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
      if (attacker && attacker.state === 'ultimate_reactor_overdrive') {
        attacker.state = (attacker.health <= 0) ? 'ko' : 'idle';
      }
      this.reactorOverdriveData = null;
    }
  }

  triggerSkyscraperFinisher(targetBuilding, attacker) {
    if (this.gameState === 'finisher_cinematic' || this.abyssalBeamData || this.reactorOverdriveData) return;
    this.gameState = 'finisher_cinematic';
    const target = attacker.opponent;

    attacker.ultimateMeter = 0;
    attacker.state = 'cinematic';
    target.state = 'cinematic';
    attacker.vx = 0;
    attacker.vz = 0;
    target.vx = 0;
    target.vz = 0;

    const toBX = targetBuilding.x - attacker.x;
    const toBZ = targetBuilding.z - attacker.z;
    attacker.rotationY = Math.atan2(toBX, toBZ);

    const toAttackerX = attacker.x - target.x;
    const toAttackerZ = attacker.z - target.z;
    target.rotationY = Math.atan2(toAttackerX, toAttackerZ);

    this.finisherData = {
      attackerSlot: attacker.slot,
      targetSlot: target.slot,
      buildingId: targetBuilding.id,
      stage: 1,
      stageTimer: 0,
      totalTimer: 0,
      maxDuration: 6.0
    };

    this.events.push({ type: 'seismic_lance_start', attackerSlot: attacker.slot, buildingId: targetBuilding.id });
    this.events.push({ type: 'announcement', title: 'SEISMIC LANCE!', sub: `${attacker.config.name} SEIZES SKYSCRAPER!`, duration: 1.4 });
  }

  updateFinisherCinematic(dt) {
    if (!this.finisherData) return;
    const data = this.finisherData;
    data.stageTimer += dt;
    data.totalTimer += dt;

    const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
    const target = data.targetSlot === 'p1' ? this.p1 : this.p2;
    const building = this.buildings.find(b => b.id === data.buildingId);

    // Watchdog
    if (data.totalTimer >= data.maxDuration) {
      this.cleanupFinisherCinematic();
      if (target.health <= 0) this.endRound(attacker.slot);
      else {
        attacker.state = 'idle';
        target.state = (target.health <= 0) ? 'ko' : 'idle';
        this.gameState = 'fighting';
      }
      return;
    }

    // Stage 1: Fracture Spire (0.8s)
    if (data.stage === 1) {
      if (data.stageTimer >= 0.8) {
        data.stage = 2;
        data.stageTimer = 0;
        if (building && !building.destroyed) {
          this.damageBuilding(building, 200, { x: building.x, z: building.z });
        }
        this.events.push({ type: 'announcement', title: 'SEISMIC LANCE!', sub: 'HOISTING BROKEN TOWER OVERHEAD!', duration: 1.2 });
      }
    }
    // Stage 2: Windup / Hoist (0.8s)
    else if (data.stage === 2) {
      if (data.stageTimer >= 0.8) {
        data.stage = 3;
        data.stageTimer = 0;
      }
    }
    // Stage 3: Lunge & Spear Strike (0.7s)
    else if (data.stage === 3) {
      if (data.stageTimer >= 0.7) {
        data.stage = 4;
        data.stageTimer = 0;

        // Deal crushing damage to target (marked as ultimate)
        this.applyDamageToFighter(target, 450, 85, 1.2, { x: attacker.x, z: attacker.z }, attacker, 'seismic_lance', false);
        this.events.push({ type: 'spear_impact', x: target.x, z: target.z });
      }
    }
    // Stage 4: Resolution (0.8s)
    else if (data.stage === 4) {
      if (data.stageTimer >= 0.8) {
        // Permanently consume and destroy skyscraper
        if (building && !building.destroyed) {
          building.destroyed = true;
          building.isFinisher = false;
          building.isConsumed = true;
          this.damageBuilding(building, 500, { x: building.x, z: building.z });
        }
        this.cleanupFinisherCinematic();
        if (target.health <= 0) {
          this.endRound(attacker.slot);
        } else {
          attacker.state = 'idle';
          target.state = 'idle';
          this.gameState = 'fighting';
        }
      }
    }
  }

  cleanupFinisherCinematic() {
    if (this.finisherData) {
      const data = this.finisherData;
      const attacker = data.attackerSlot === 'p1' ? this.p1 : this.p2;
      const target = data.targetSlot === 'p1' ? this.p1 : this.p2;
      if (attacker && attacker.state === 'cinematic') attacker.state = (attacker.health <= 0) ? 'ko' : 'idle';
      if (target && target.state === 'cinematic') target.state = (target.health <= 0) ? 'ko' : 'idle';
      this.finisherData = null;
    }
  }

  updateFighterState(f, dt) {
    if (f.state === 'ko') return;

    // Timers
    if (f.invulnerableTimer > 0) f.invulnerableTimer -= dt;
    if (f.comboWindowTimer > 0) {
      f.comboWindowTimer -= dt;
      if (f.comboWindowTimer <= 0) f.comboCounter = 0;
    }
    if (f.specialCooldownTimer > 0) f.specialCooldownTimer -= dt;
    if (f.throwCooldownTimer > 0) f.throwCooldownTimer -= dt;
    if (f.sharedPowerRecoveryTimer > 0) f.sharedPowerRecoveryTimer -= dt;
    if (f.isParryActive) {
      f.parryTimer -= dt;
      if (f.parryTimer <= 0) f.isParryActive = false;
    }
    if (f.counterOpportunity) {
      f.counterOpportunityTimer -= dt;
      if (f.counterOpportunityTimer <= 0) f.counterOpportunity = false;
    }
    if (f.counterWindowTimer > 0) f.counterWindowTimer -= dt;
    if (f.counterCooldownTimer > 0) f.counterCooldownTimer -= dt;

    // Stamina Regeneration (paused during blocking or attacking)
    if (f.state !== 'blocking' && !f.state.startsWith('attack_')) {
      f.stamina = Math.min(f.maxStamina, f.stamina + f.staminaRegen * dt);
    }

    // State Machine Transitions
    if (f.state.startsWith('attack_')) {
      f.stateTimer += dt;
      const atk = f.currentAttack;
      if (atk) {
        const windup = atk.windup;
        const activeEnd = windup + atk.activeDuration;

        // Projectile release for Plasma Caster
        if (atk.isProjectile && !f.hasDealtDamage && f.stateTimer >= windup) {
          f.hasDealtDamage = true;
          this.spawnProjectile(f, atk);
        }
        // Melee hit window
        else if (!atk.isProjectile && f.stateTimer >= windup && f.stateTimer <= activeEnd && !f.hasDealtDamage) {
          this.evaluateMeleeHit(f, atk);
        }
      }

      if (f.stateTimer >= f.stateDuration) {
        f.state = 'idle';
        f.currentAttack = null;
        f.hasDealtDamage = false;
      }
    } else if (f.state === 'picking_up') {
      f.stateTimer += dt;
      if (f.stateTimer >= f.stateDuration) {
        if (f.pendingPickupProp && f.pendingPickupProp.active && f.pendingPickupProp.holder === f.slot) {
          f.heldObject = f.pendingPickupProp;
          f.pendingPickupProp.isHeld = true;
          f.state = 'holding_object';
          f.stateTimer = 0;
        } else {
          f.state = 'idle';
        }
        f.pendingPickupProp = null;
      }
    } else if (f.state === 'holding_object') {
      f.stateTimer += dt;
    } else if (f.state === 'throw_recovery') {
      f.stateTimer += dt;
      if (f.stateTimer >= f.stateDuration) {
        f.state = 'idle';
      }
    } else if (f.state === 'dodging') {
      f.stateTimer += dt;
      if (f.stateTimer >= f.stateDuration) {
        f.state = 'idle';
      }
    } else if (f.state === 'hurt') {
      f.hitStunTimer -= dt;
      if (f.hitStunTimer <= 0) {
        f.state = 'idle';
      }
    }

    // Integrate velocity & friction
    f.x += f.vx * dt;
    f.z += f.vz * dt;
    const frictionRate = (f.state === 'dodging') ? 0.8 : 6.0;
    const damp = Math.exp(-frictionRate * dt);
    f.vx *= damp;
    f.vz *= damp;

    // Arena boundary clamp
    this.clampToWalkableLand(f);
  }

  evaluateMeleeHit(attacker, atk) {
    const opp = attacker.opponent;
    if (!opp || attacker.hasDealtDamage) return;

    const fwdX = Math.sin(attacker.rotationY);
    const fwdZ = Math.cos(attacker.rotationY);
    const strikeX = attacker.x + fwdX * (attacker.hurtboxRadius + 18.0);
    const strikeZ = attacker.z + fwdZ * (attacker.hurtboxRadius + 18.0);
    const strikeReach = 18.0;

    const distToOpp = Math.hypot(opp.x - strikeX, opp.z - strikeZ);
    if (distToOpp <= (opp.hurtboxRadius + strikeReach)) {
      attacker.hasDealtDamage = true;
      this.applyDamageToFighter(opp, atk.damage, atk.knockback, atk.hitstun, { x: attacker.x, z: attacker.z }, attacker, atk.animationType, false);
    }
  }

  spawnProjectile(attacker, atk) {
    const fwdX = Math.sin(attacker.rotationY);
    const fwdZ = Math.cos(attacker.rotationY);
    const projId = `proj_${++this.projectileCounter}`;
    const spawnX = attacker.x + fwdX * (attacker.hurtboxRadius + 12);
    const spawnZ = attacker.z + fwdZ * (attacker.hurtboxRadius + 12);
    const speed = atk.projectileSpeed || 190;

    this.projectiles.push({
      id: projId,
      type: attacker.charId === 'gipsy' ? 'plasma' : 'emp',
      x: spawnX,
      z: spawnZ,
      y: attacker.height * 0.65,
      vx: fwdX * speed,
      vz: fwdZ * speed,
      radius: atk.projectileRadius || 7.5,
      damage: atk.damage || 220,
      knockback: atk.knockback || 65,
      hitstun: atk.hitstun || 0.85,
      ownerSlot: attacker.slot,
      distanceTraveled: 0,
      maxRange: atk.range || 160
    });

    this.events.push({
      type: 'projectile_spawned',
      id: projId,
      projType: attacker.charId === 'gipsy' ? 'plasma' : 'emp',
      x: spawnX,
      z: spawnZ,
      vx: fwdX * speed,
      vz: fwdZ * speed,
      ownerSlot: attacker.slot
    });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const stepDist = Math.hypot(p.vx * dt, p.vz * dt);
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.distanceTraveled += stepDist;

      let destroyed = false;

      // Check opponent hit
      const opp = p.ownerSlot === 'p1' ? this.p2 : this.p1;
      const distToOpp = Math.hypot(opp.x - p.x, opp.z - p.z);
      if (distToOpp <= (opp.hurtboxRadius + p.radius)) {
        const attacker = p.ownerSlot === 'p1' ? this.p1 : this.p2;
        this.applyDamageToFighter(opp, p.damage, p.knockback, p.hitstun, { x: p.x, z: p.z }, attacker, 'projectile', true);
        this.events.push({ type: 'projectile_burst', id: p.id, x: p.x, z: p.z });
        destroyed = true;
      }

      // Check building hit
      if (!destroyed) {
        for (const b of this.buildings) {
          if (b.destroyed) continue;
          if (Math.hypot(b.x - p.x, b.z - p.z) <= (b.radius + p.radius)) {
            this.damageBuilding(b, 100, { x: p.x, z: p.z });
            this.events.push({ type: 'projectile_burst', id: p.id, x: p.x, z: p.z });
            destroyed = true;
            break;
          }
        }
      }

      // Max range or arena exit
      if (!destroyed && (p.distanceTraveled >= p.maxRange || p.z < this.bounds.shorelineZ - 40 || p.z > this.bounds.landwardZ + 40)) {
        this.events.push({ type: 'projectile_expired', id: p.id });
        destroyed = true;
      }

      if (destroyed) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateEnvironmentalProps(dt) {
    for (const prop of this.props) {
      if (!prop.active) continue;

      if (prop.safeTimer > 0) prop.safeTimer -= dt;

      if (prop.isThrown) {
        prop.x += prop.vx * dt;
        prop.z += prop.vz * dt;

        // Opponent collision
        const opp = prop.thrower === 'p1' ? this.p2 : this.p1;
        const distToOpp = Math.hypot(opp.x - prop.x, opp.z - prop.z);
        if (prop.safeTimer <= 0 && distToOpp <= (opp.hurtboxRadius + prop.radius)) {
          const attacker = prop.thrower === 'p1' ? this.p1 : this.p2;
          this.applyDamageToFighter(opp, prop.damage, 65, 0.75, { x: prop.x, z: prop.z }, attacker, 'thrown_prop', false);
          this.shatterProp(prop);
          continue;
        }

        // Building collision
        for (const b of this.buildings) {
          if (b.destroyed) continue;
          if (Math.hypot(b.x - prop.x, b.z - prop.z) <= (b.radius + prop.radius)) {
            this.damageBuilding(b, 120, { x: prop.x, z: prop.z });
            this.shatterProp(prop);
            break;
          }
        }
      }
    }
  }

  shatterProp(prop) {
    prop.active = false;
    prop.isThrown = false;
    prop.isHeld = false;
    this.events.push({ type: 'prop_shattered', propId: prop.id, x: prop.x, z: prop.z });
  }

  applyDamageToFighter(target, damage, knockback, hitstun, attackerPos, attacker, attackType = 'light', isProjectile = false) {
    if (target.state === 'ko' || target.invulnerableTimer > 0) return 0;

    // 1. Parry Check
    if (target.isParryActive && !isProjectile) {
      target.isParryActive = false;
      target.parryTimer = 0;
      target.counterOpportunity = true;
      target.counterOpportunityTimer = 2.4;
      target.counterWindowTimer = 1.30;
      target.counterCooldownTimer = 6.0;

      if (attacker) {
        attacker.state = 'hurt';
        attacker.hitStunTimer = 1.15;
        attacker.stateTimer = 0;
        attacker.stateDuration = 1.15;
        attacker.currentAttack = null;
        attacker.hasDealtDamage = false;
        attacker.vx = 0;
        attacker.vz = 0;
      }

      this.events.push({ type: 'parry_clang', slot: target.slot, attackerSlot: attacker ? attacker.slot : null });
      this.events.push({ type: 'announcement', title: 'PARRY!', sub: 'ENEMY STAGGERED — PRESS [K] TO COUNTER!', duration: 1.30 });
      return 0;
    }

    let actualDamage = damage;
    let actualKnockback = knockback;

    // 2. Block Guard
    if (target.state === 'blocking') {
      actualDamage *= 0.20; // 80% mitigation
      actualKnockback *= 0.25;
      target.stamina = Math.max(0, target.stamina - 15);
      if (target.stamina <= 0) {
        target.state = 'hurt';
        target.hitStunTimer = 0.85;
      }
      this.events.push({ type: 'block_impact', slot: target.slot, damage: actualDamage });
    } else {
      // 3. Clean Impact (Super-armor during active ultimate states)
      const isSuperArmor = (target.state === 'ultimate_abyssal_beam' || target.state === 'ultimate_reactor_overdrive' || target.state === 'cinematic');
      if (!isSuperArmor) {
        target.state = 'hurt';
        target.hitStunTimer = hitstun;
        target.stateTimer = 0;
        target.stateDuration = hitstun;
        target.currentAttack = null;
        target.hasDealtDamage = false;

        // Drop held object on hit
        if (target.heldObject) {
          target.heldObject.isHeld = false;
          target.heldObject.holder = null;
          target.heldObject.isThrown = false;
          target.heldObject = null;
        }
      }

      target.consecutiveHitsTaken++;
      const isUltimate = (attackType === 'abyssal_beam' || attackType === 'seismic_lance' || attackType === 'reactor_overdrive' || attackType === 'reactor_slash' || attackType === 'reactor_blast');
      if (!isUltimate && target.consecutiveHitsTaken >= 3) {
        target.invulnerableTimer = 0.35;
        target.consecutiveHitsTaken = 0;
      }

      this.events.push({ type: 'hit_spark', slot: target.slot, x: target.x, z: target.z, damage: actualDamage, attackType });
    }

    // Apply Health loss
    target.health = Math.max(0, target.health - actualDamage);

    // Ultimate meter earning: only non-ultimate attacks generate meter
    const isUltimateAtk = (attackType === 'abyssal_beam' || attackType === 'seismic_lance' || attackType === 'reactor_overdrive' || attackType === 'reactor_slash' || attackType === 'reactor_blast');
    if (!isUltimateAtk) {
      if (actualDamage > 0) {
        target.ultimateMeter = Math.min(target.maxUltimate, target.ultimateMeter + actualDamage * 0.04);
      }
      if (attacker && actualDamage > 0) {
        const gain = (attackType === 'heavy_counter') ? 22 : (attackType === 'heavy_hook' || attackType === 'ground_smash' ? 16 : 10);
        attacker.ultimateMeter = Math.min(attacker.maxUltimate, attacker.ultimateMeter + gain);
      }
    }

    // Knockback
    if (attackerPos) {
      const dx = target.x - attackerPos.x;
      const dz = target.z - attackerPos.z;
      const dLen = Math.hypot(dx, dz);
      if (dLen > 0.01) {
        target.vx += (dx / dLen) * actualKnockback * 2.8;
        target.vz += (dz / dLen) * actualKnockback * 2.8;
      }
    }

    if (target.health <= 0) {
      target.state = 'ko';
    }

    return actualDamage;
  }

  damageBuilding(b, damage, impactPos) {
    if (b.destroyed) return;
    b.health = Math.max(0, b.health - damage);
    if (b.health <= 0) {
      b.destroyed = true;
      this.events.push({ type: 'building_destroyed', id: b.id, x: b.x, z: b.z });
    } else {
      this.events.push({ type: 'building_damaged', id: b.id, damage, x: impactPos ? impactPos.x : b.x, z: impactPos ? impactPos.z : b.z });
    }
  }

  resolveFighterCollisions() {
    const p1 = this.p1;
    const p2 = this.p2;
    if (p1.state === 'ko' && p2.state === 'ko') return;

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const dist = Math.hypot(dx, dz);
    const minDist = 48.0; // Enforced 48m minimum separation to avoid mesh overlap while allowing attacks to connect

    if (dist < minDist && dist > 0.001) {
      const overlap = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      p1.x -= nx * overlap * 0.5;
      p1.z -= nz * overlap * 0.5;
      p2.x += nx * overlap * 0.5;
      p2.z += nz * overlap * 0.5;

      this.clampToWalkableLand(p1);
      this.clampToWalkableLand(p2);

      const relVx = p1.vx - p2.vx;
      const relVz = p1.vz - p2.vz;
      const velAlongNormal = relVx * nx + relVz * nz;
      if (velAlongNormal > 0) {
        p1.vx -= nx * velAlongNormal * 0.5;
        p1.vz -= nz * velAlongNormal * 0.5;
        p2.vx += nx * velAlongNormal * 0.5;
        p2.vz += nz * velAlongNormal * 0.5;
      }
    }
  }

  checkFighterBuildingCollisions(f) {
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      const dx = f.x - b.x;
      const dz = f.z - b.z;
      const dist = Math.hypot(dx, dz);
      const minDistance = b.radius + f.hurtboxRadius;

      if (dist < minDistance && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDistance - dist;
        f.x += nx * overlap;
        f.z += nz * overlap;
        this.clampToWalkableLand(f);

        // If charging or high impact velocity, damage building
        const speed = Math.hypot(f.vx, f.vz);
        if (speed > 45) {
          this.damageBuilding(b, 90, { x: f.x, z: f.z });
          f.vx *= -0.3;
          f.vz *= -0.3;
        }
      }
    }
  }

  clampToWalkableLand(f) {
    const minZ = this.bounds.shorelineZ + f.hurtboxRadius + 2.0;
    const maxZ = this.bounds.landwardZ - f.hurtboxRadius - 2.0;
    const minX = this.bounds.flankMinX + f.hurtboxRadius + 2.0;
    const maxX = this.bounds.flankMaxX - f.hurtboxRadius - 2.0;

    f.z = Math.max(minZ, Math.min(maxZ, f.z));
    f.x = Math.max(minX, Math.min(maxX, f.x));
  }

  endRound(winner) {
    if (this.gameState !== 'fighting' && this.gameState !== 'finisher_cinematic' && this.gameState !== 'abyssal_beam' && this.gameState !== 'reactor_overdrive') return;
    this.cleanupAbyssalBeam();
    this.cleanupReactorOverdrive();
    this.cleanupFinisherCinematic();
    this.gameState = 'round_over';

    if (winner === 'p1') {
      this.p1Wins++;
      this.events.push({ type: 'announcement', title: 'PLAYER 1 WINS ROUND', sub: '', duration: 2.5 });
    } else if (winner === 'p2') {
      this.p2Wins++;
      this.events.push({ type: 'announcement', title: 'PLAYER 2 WINS ROUND', sub: '', duration: 2.5 });
    } else {
      this.events.push({ type: 'announcement', title: 'DOUBLE KO / DRAW', sub: '', duration: 2.5 });
    }

    this.roundTransitionTimer = 2.8;
    this.targetTransitionCallback = () => {
      if (this.p1Wins >= this.targetWins) {
        this.endMatch('p1');
      } else if (this.p2Wins >= this.targetWins) {
        this.endMatch('p2');
      } else {
        this.currentRound++;
        this.startRound();
      }
    };
  }

  startRound() {
    this.cleanupAbyssalBeam();
    this.cleanupReactorOverdrive();
    this.cleanupFinisherCinematic();
    this.projectiles = [];
    this.roundTimer = this.roundDuration;
    this.gameState = 'countdown';
    this.countdownTimer = 3.0;

    // Reposition fighters facing each other and clear transient states
    this.resetFighter(this.p1, -65, 0, Math.PI / 2);
    this.resetFighter(this.p2, 65, 0, -Math.PI / 2);

    this.events.push({
      type: 'round_started',
      round: this.currentRound,
      roundTimer: this.roundDuration,
      p1Wins: this.p1Wins,
      p2Wins: this.p2Wins
    });
  }

  endMatch(winnerSlot) {
    this.gameState = 'match_over';
    this.events.push({ type: 'match_over', winnerSlot, p1Wins: this.p1Wins, p2Wins: this.p2Wins });
  }

  resetMatch() {
    this.cleanupAbyssalBeam();
    this.cleanupReactorOverdrive();
    this.cleanupFinisherCinematic();
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.currentRound = 1;
    this.initArena();
    this.startRound();
  }

  pauseForDisconnect(disconnectedSlot, gracePeriodSec = 15) {
    if (this.gameState === 'match_over') return;
    this.previousStateBeforeDisconnect = this.gameState;
    this.gameState = 'paused_disconnect';
    this.events.push({ type: 'match_paused_disconnect', slot: disconnectedSlot, gracePeriodSec });
  }

  resumeAfterReconnect() {
    if (this.gameState === 'paused_disconnect') {
      this.gameState = 'countdown';
      this.countdownTimer = 3.0;
      this.events.push({ type: 'match_resumed' });
    }
  }

  getSnapshot() {
    return {
      tick: this.tick,
      gameState: this.gameState,
      roundTimer: this.roundTimer,
      countdownTimer: this.countdownTimer,
      currentRound: this.currentRound,
      p1Wins: this.p1Wins,
      p2Wins: this.p2Wins,
      p1: {
        x: Number(this.p1.x.toFixed(2)),
        z: Number(this.p1.z.toFixed(2)),
        y: Number(this.p1.y.toFixed(2)),
        rotationY: Number(this.p1.rotationY.toFixed(3)),
        vx: Number(this.p1.vx.toFixed(2)),
        vz: Number(this.p1.vz.toFixed(2)),
        health: Math.ceil(this.p1.health),
        maxHealth: this.p1.maxHealth,
        stamina: Math.ceil(this.p1.stamina),
        ultimateMeter: Math.floor(this.p1.ultimateMeter),
        state: this.p1.state,
        stateTimer: Number(this.p1.stateTimer.toFixed(2)),
        stateDuration: Number(this.p1.stateDuration.toFixed(2)),
        currentAttack: this.p1.currentAttack ? this.p1.currentAttack.animationType : null,
        isParryActive: this.p1.isParryActive,
        counterOpportunity: this.p1.counterOpportunity,
        counterWindowTimer: Number(this.p1.counterWindowTimer.toFixed(2)),
        specialCooldownTimer: Number(this.p1.specialCooldownTimer.toFixed(1)),
        heldObjectId: this.p1.heldObject ? this.p1.heldObject.id : null,
        lastProcessedSeq: this.p1.lastProcessedSeq
      },
      p2: {
        x: Number(this.p2.x.toFixed(2)),
        z: Number(this.p2.z.toFixed(2)),
        y: Number(this.p2.y.toFixed(2)),
        rotationY: Number(this.p2.rotationY.toFixed(3)),
        vx: Number(this.p2.vx.toFixed(2)),
        vz: Number(this.p2.vz.toFixed(2)),
        health: Math.ceil(this.p2.health),
        maxHealth: this.p2.maxHealth,
        stamina: Math.ceil(this.p2.stamina),
        ultimateMeter: Math.floor(this.p2.ultimateMeter),
        state: this.p2.state,
        stateTimer: Number(this.p2.stateTimer.toFixed(2)),
        stateDuration: Number(this.p2.stateDuration.toFixed(2)),
        currentAttack: this.p2.currentAttack ? this.p2.currentAttack.animationType : null,
        isParryActive: this.p2.isParryActive,
        counterOpportunity: this.p2.counterOpportunity,
        counterWindowTimer: Number(this.p2.counterWindowTimer.toFixed(2)),
        specialCooldownTimer: Number(this.p2.specialCooldownTimer.toFixed(1)),
        heldObjectId: this.p2.heldObject ? this.p2.heldObject.id : null,
        lastProcessedSeq: this.p2.lastProcessedSeq
      },
      buildings: this.buildings.map(b => ({ id: b.id, health: b.health, destroyed: b.destroyed })),
      props: this.props.map(p => ({
        id: p.id,
        x: Number(p.x.toFixed(2)),
        z: Number(p.z.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        isHeld: p.isHeld,
        holder: p.holder,
        isThrown: p.isThrown,
        active: p.active
      })),
      projectiles: this.projectiles.map(p => ({
        id: p.id,
        type: p.type,
        x: Number(p.x.toFixed(2)),
        z: Number(p.z.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        vx: Number(p.vx.toFixed(2)),
        vz: Number(p.vz.toFixed(2))
      })),
      events: this.events
    };
  }
}
