/* =============================================================================
   TITAN CLASH 3D - CHARACTER CONFIGURATION & ROSTER DEFINITION
   Configurable, replaceable character stats, scale, attack frames, and abilities
   ============================================================================= */

export const CHARACTER_ROSTER = {
  gridman: {
    id: 'gridman',
    name: 'GRIDMAN (Placeholder Robot — Gridman model pending)',
    type: 'mecha',
    classTitle: 'Energy Mecha (Placeholder Robot — Gridman model pending)',
    // Scale settings (1 unit ≈ 1 meter)
    // Gridman provisional canonical giant height: ~70 meters
    height: 70,
    width: 24,
    depth: 18,
    weightClass: 'medium', // light, medium, heavy, super-heavy
    liftCapacity: 'medium', // Can lift containers and cars

    // Base Combat Attributes
    maxHealth: 2000,
    maxStamina: 100,
    staminaRegenRate: 20, // per sec
    moveSpeed: 38,
    dodgeSpeed: 85,
    turnSpeed: 6.0,

    // Combat Timing & Frame Data (in seconds)
    attacks: {
      counter: {
        name: 'Grid Spark Overdrive Counter',
        damage: 260,
        staminaCost: 0,
        windup: 0.12,
        activeDuration: 0.20,
        recovery: 0.35,
        range: 45,
        knockback: 70,
        hitstun: 0.90,
        animationType: 'heavy_counter'
      },
      light: {
        name: 'Grid Punch',
        damage: 45,
        staminaCost: 10,
        windup: 0.18,
        activeDuration: 0.14,
        recovery: 0.22,
        range: 30,
        knockback: 12,
        hitstun: 0.35,
        animationType: 'punch_right'
      },
      heavy: {
        name: 'Plasma Chop',
        damage: 90,
        staminaCost: 22,
        windup: 0.38,
        activeDuration: 0.18,
        recovery: 0.45,
        range: 34,
        knockback: 26,
        hitstun: 0.55,
        animationType: 'chop_down'
      },
      comboFinisher: {
        name: 'Spark Surge Kick',
        damage: 135,
        staminaCost: 30,
        windup: 0.30,
        activeDuration: 0.20,
        recovery: 0.50,
        range: 36,
        knockback: 45,
        hitstun: 0.70,
        animationType: 'kick_forward'
      },
      special: {
        name: 'Grid Beam',
        damage: 190,
        staminaCost: 45,
        cooldown: 8.0,
        windup: 0.65,
        activeDuration: 0.35,
        recovery: 0.60,
        range: 160, // Long-range beam projectile
        knockback: 55,
        hitstun: 0.85,
        isProjectile: true,
        projectileSpeed: 210,
        projectileRadius: 7.0,
        projectileColor: 0x00f0ff,
        animationType: 'beam_cast'
      }
    },

    // Model Configuration & Animation Mapping
    modelConfig: {
      type: 'gltf', // 'gltf' or 'procedural'
      path: './assets/models/mecha_rig.glb',
      targetHeight: 70, // meters
      groundOffset: 0,
      rotationOffsetY: 0,
      materialOverrides: {
        metalness: 0.85,
        roughness: 0.3
      },
      animationMap: {
        idle: 'Idle',
        moving: 'Walking',
        attack_light: 'Punch',
        attack_heavy: 'Punch',
        attack_comboFinisher: 'Jump',
        attack_special: 'ThumbsUp',
        throw_object: 'Wave',
        hurt: 'No',
        ko: 'Death',
        blocking: 'Sitting'
      }
    },

    // Visual Palette & Design
    colors: {
      primary: 0xd91b24,    // Heroic Crimson
      secondary: 0x1a45a3,  // Royal Cobalt Blue
      accents: 0xd4af37,    // Solar Gold
      glow: 0x00f0ff,       // Hyper Agent Cyan Glow
      visor: 0xffea00
    },

    placeholderBio: 'A high-agility digital cyber warrior configured with balance, beam projections, and responsive counter-attacks.'
  },

  gipsy: {
    id: 'gipsy',
    name: 'GIPSY DANGER (Mark-3)',
    type: 'mecha',
    classTitle: 'Colossal Jaeger',
    // Gipsy Danger canon height: 79 meters
    height: 79,
    width: 29,
    depth: 22,
    weightClass: 'heavy',
    liftCapacity: 'heavy', // Can lift containers, tanks, rubble

    // Base Combat Attributes
    maxHealth: 2400,
    maxStamina: 100,
    staminaRegenRate: 15,
    moveSpeed: 30, // Slower, massive inertia
    dodgeSpeed: 70,
    turnSpeed: 4.8,

    // Combat Timing & Frame Data
    attacks: {
      counter: {
        name: 'Rocket Elbow Overdrive Counter',
        damage: 285,
        staminaCost: 0,
        windup: 0.12,
        activeDuration: 0.20,
        recovery: 0.35,
        range: 52,
        knockback: 75,
        hitstun: 0.95,
        animationType: 'heavy_counter'
      },
      light: {
        name: 'Right Turbine Straight Jab',
        damage: 48,
        staminaCost: 12,
        windup: 0.16,
        activeDuration: 0.14,
        recovery: 0.22,
        range: 48,
        knockback: 16,
        hitstun: 0.32,
        animationType: 'punch_right'
      },
      light2: {
        name: 'Left Turbine Cross',
        damage: 68,
        staminaCost: 15,
        windup: 0.18,
        activeDuration: 0.16,
        recovery: 0.22,
        range: 50,
        knockback: 26,
        hitstun: 0.38,
        animationType: 'punch_left'
      },
      heavy: {
        name: 'Elbow Rocket Hook',
        damage: 120,
        staminaCost: 28,
        windup: 0.32,
        activeDuration: 0.20,
        recovery: 0.38,
        range: 52,
        knockback: 48,
        hitstun: 0.60,
        animationType: 'heavy_hook'
      },
      comboFinisher: {
        name: 'Dual Turbine Overload Uppercut',
        damage: 165,
        staminaCost: 35,
        windup: 0.25,
        activeDuration: 0.20,
        recovery: 0.40,
        range: 52,
        knockback: 65,
        hitstun: 0.80,
        animationType: 'heavy_uppercut'
      },
      special: {
        name: 'Plasma Caster Blast',
        damage: 220,
        staminaCost: 50,
        cooldown: 10.0,
        windup: 0.85,
        activeDuration: 0.30,
        recovery: 0.70,
        range: 150,
        knockback: 65,
        hitstun: 0.90,
        isProjectile: true,
        projectileSpeed: 170,
        projectileRadius: 9.0,
        projectileColor: 0xffaa00,
        animationType: 'plasma_cannon'
      },
      ultimate: {
        name: 'Seismic Lance',
        description: 'Colossal Skyscraper Spear Finisher',
        damage: 550,
        staminaCost: 0,
        type: 'environmental_cinematic',
        requiresTower: true,
        towerRange: 65,
        opponentRange: 65,
        animationType: 'seismic_lance'
      }
    },

    // Model Configuration & Animation Mapping
    modelConfig: {
      type: 'gltf',
      path: './assets/models/gipsy_danger.glb',
      kaykitAnimations: false,
      targetHeight: 79,
      groundOffset: 0,
      rotationOffsetY: 0,
      materialOverrides: {
        metalness: 0.85,
        roughness: 0.28
      },
      animationMap: {
        idle: 'Idle',
        moving: 'moving',
        walk_forward: 'walk_forward',
        walk_backward: 'walk_backward',
        strafe_left: 'strafe_left',
        strafe_right: 'strafe_right',
        attack_light: 'attack_light',
        attack_light2: 'attack_light2',
        attack_heavy: 'attack_heavy',
        attack_comboFinisher: 'attack_comboFinisher',
        attack_special: 'Gipsy_Danger_Plasma_caster',
        blocking: 'blocking',
        hurt: 'hurt',
        ko: 'ko'
      }
    },

    colors: {
      primary: 0x1b2d48,   // Jaeger Battleship Navy
      secondary: 0x3d4f68, // Industrial Steel
      accents: 0xb58d3d,   // Warning Hazard Gold
      glow: 0xff8c00,      // Vortex Turbine Orange Glow
      visor: 0x55d6ff
    },

    placeholderBio: 'Massive nuclear-powered Mark-3 Jaeger engineered for extreme kinetic force, chain sword cleaves, and plasma discharge.'
  },

  leatherback: {
    id: 'leatherback',
    name: 'LEATHERBACK (Category IV)',
    type: 'kaiju',
    classTitle: 'Cat-IV Kaiju (EMP Brute)',
    // Canon Leatherback: 85 meters tall, colossal ape-like breadth and mass
    height: 85,
    width: 42,
    depth: 40,
    weightClass: 'super-heavy',
    liftCapacity: 'heavy',

    // Base Combat Attributes
    maxHealth: 2800,
    maxStamina: 120,
    staminaRegenRate: 15,
    moveSpeed: 29,
    dodgeSpeed: 62,
    turnSpeed: 4.5,

    // Combat Timing & Frame Data
    attacks: {
      counter: {
        name: 'Earthquake Knuckle Counter',
        damage: 300,
        staminaCost: 0,
        windup: 0.12,
        activeDuration: 0.20,
        recovery: 0.35,
        range: 52,
        knockback: 80,
        hitstun: 1.0,
        animationType: 'heavy_counter'
      },
      light: {
        name: 'Hammer Knuckle Swipe',
        damage: 55,
        staminaCost: 12,
        windup: 0.18,
        activeDuration: 0.14,
        recovery: 0.30,
        range: 50,
        knockback: 22,
        hitstun: 0.32,
        animationType: 'claw_swipe'
      },
      heavy: {
        name: 'Heavy Knuckle Hook',
        damage: 125,
        staminaCost: 28,
        windup: 0.28,
        activeDuration: 0.20,
        recovery: 0.58, // Clear punishable recovery window
        range: 52,
        knockback: 52,
        hitstun: 0.58,
        animationType: 'heavy_hook'
      },
      comboFinisher: {
        name: 'Two-Handed Ground Smash',
        damage: 175,
        staminaCost: 38,
        windup: 0.38,
        activeDuration: 0.25,
        recovery: 0.70, // Long exploitable recovery after ground smash
        range: 54,
        knockback: 70,
        hitstun: 0.80,
        animationType: 'ground_smash'
      },
      special: {
        name: 'EMP Surge Shockwave',
        damage: 230,
        staminaCost: 50,
        cooldown: 8.5, // At least 8 seconds between special powers
        windup: 0.95, // Clearly visible charging windup
        activeDuration: 0.35,
        recovery: 0.80, // Exploitable recovery window
        range: 155,
        knockback: 70,
        hitstun: 0.95,
        isProjectile: true,
        projectileSpeed: 175,
        projectileRadius: 9.5,
        projectileColor: 0x00f0ff,
        animationType: 'emp_blast'
      },
      ultimate: {
        name: 'Abyssal Beam',
        description: 'Bioluminescent Mouth-Beam Blast',
        damage: 500, // Substantial but capped total damage per activation
        staminaCost: 0,
        type: 'energy_beam',
        beamRange: 220,
        beamRadius: 5.5,
        windup: 1.10, // Charge & throat glow
        aimLockTime: 0.75, // Aim locks at 0.75s allowing opponent to dodge sideways
        activeDuration: 1.50, // Sustained beam firing duration
        recovery: 1.00, // Vulnerable recovery window
        beamColor: 0x00f0ff,
        coreColor: 0xffffff,
        animationType: 'abyssal_beam'
      }
    },

    // Model Configuration & Animation Mapping
    modelConfig: {
      type: 'gltf',
      path: './assets/models/leatherback.glb',
      kaykitAnimations: false,
      targetHeight: 85,
      groundOffset: 0,
      rotationOffsetY: 0,
      materialOverrides: {
        metalness: 0.15,
        roughness: 0.65
      },
      animationMap: {
        idle: 'idle',
        moving: 'moving',
        walk_forward: 'walk_forward',
        walk_backward: 'walk_backward',
        strafe_left: 'strafe_left',
        strafe_right: 'strafe_right',
        attack_light: 'attack_light',
        attack_heavy: 'attack_heavy',
        attack_comboFinisher: 'attack_comboFinisher',
        attack_special: 'attack_special',
        ultimate_abyssal_beam: 'ultimate_abyssal_beam',
        blocking: 'blocking',
        hurt: 'hurt',
        ko: 'ko'
      }
    },

    colors: {
      primary: 0x1f272a,   // Deep Obsidian Armored Chitin
      secondary: 0x2e3b40, // Abyssal Kaiju Hide
      accents: 0x00e5ff,   // Bioluminescent Electric EMP Cyan
      glow: 0x00b4d8,      // Bio-electric Internal Organ
      visor: 0xff0044      // Menacing Quad Kaiju Eyes
    },

    placeholderBio: 'Category IV brute kaiju built like a colossal silverback gorilla. Boasts devastating physical strength, dense armored carapace, and an organic EMP organ capable of disabling electrical systems.'
  }
};
