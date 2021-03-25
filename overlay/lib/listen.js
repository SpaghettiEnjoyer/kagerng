'use strict'
// aaaaaadsdsqdqaaaaa
let expectedCritChance = 0;
let expectedDhChance = 0;
let expectedCritDhChance = 0;
let goodRngSfx = undefined;
let badRngSfx = undefined;
let lastPlayedSound = -1; // -1 plays any, 0 plays good mp3, 1 plays bad mp3

let lastSaveId = "";
let lastKnownDuration = 0;
let isNewEncounter = false;

let overallCritAndDhData = {}; // key, object pair: name (str), [[swings, critCount, dhCount, critDhCount], ...] (arr 2 x 4)
let last60SecCritAndDhData = {}; // key, object pair: name (str), [[swings, critCount, dhCount, critDhCount], ...] (arr 60 x 4)
let index60 = 0;

function initSfx() {
  if (goodRngSfx === undefined) {
    const goodRngSfxConfig = config.get('sfx.good_rng');
    goodRngSfx = (goodRngSfxConfig === undefined) ? new Howl({src: "", volume: 100, loop: true}) : new Howl({src: [goodRngSfxConfig.data_url], volume: goodRngSfxConfig.volume, loop: goodRngSfxConfig.loop});
  }
  if (badRngSfx === undefined) {
    const badRngSfxConfig = config.get('sfx.bad_rng');
    badRngSfx = (badRngSfxConfig === undefined) ? new Howl({src: "", volume: 100, loop: true}) : new Howl({src: [badRngSfxConfig.data_url], volume: badRngSfxConfig.volume, loop: badRngSfxConfig.loop});
  }
}

function updateUserDependentData() {
  const selectedPreset = config.get('stats.presets.selected')
  expectedCritChance = Math.floor(200 * (Math.max(selectedPreset.crit_points, 380) - 380) / 3300 + 50) / 1000;
  expectedDhChance = Math.floor(550 * (Math.max(selectedPreset.dh_points, 380) - 380) / 3300) / 1000;
  expectedCritDhChance = expectedCritChance * expectedDhChance;

  const goodRngSfxConfig = config.get('sfx.good_rng');

  if (goodRngSfxConfig.file_has_changed) {
    config.set('sfx.good_rng.file_has_changed', false);
    goodRngSfx.src = [goodRngSfxConfig.data];
  }

  goodRngSfx.volume(goodRngSfxConfig.volume);
  goodRngSfx.loop(goodRngSfxConfig.loop);
  
  const badRngSfxConfig = config.get('sfx.bad_rng');
  if (badRngSfxConfig.file_has_changed) {
    config.set('sfx.good_rng.file_has_changed', false);
    badRngSfx.src = [badRngSfxConfig.data];
  }
  badRngSfx.volume(badRngSfxConfig.volume);
  badRngSfx.loop(badRngSfxConfig.loop);
}


function resetLast60SecCritAndDhData() {
  lastPlayedSound = -1;
  index60 = 0;
  last60SecCritAndDhData = {};
}


function initAddedCritAndDhData(parseData) {
  for (let i = 0; i != parseData.length; ++i) {
    const playerName = parseData[i].name;
    if (!overallCritAndDhData.hasOwnProperty(playerName)) {
      let overallArr = overallCritAndDhData[playerName] = new Array(2);
      overallArr[0] = new Array(4).fill(0);
      overallArr[1] = new Array(4).fill(0);

      let last60SecArr = last60SecCritAndDhData[playerName] = new Array(60);
      for (let i = 0; i != 60; ++i) 
        last60SecArr[i] = new Array(4).fill(0);
    }
    else if (!last60SecCritAndDhData.hasOwnProperty(playerName)) {
      let last60SecArr = last60SecCritAndDhData[playerName] = new Array(60);
      for (let i = 0; i != 60; ++i) 
        last60SecArr[i] = new Array(4).fill(0);
    }
  }
}

// reinit with the last known data
function reinitLast60SecCritAndDhData() {
  const keys = Object.keys(last60SecCritAndDhData);
  const prevIndex60 = Math.max(index60 - 1, 0);
  for (let i = 0; i != keys.length; ++i) {
    let playerLast60SecCritAndDhData = last60SecCritAndDhData[keys[i]];
    for(let j = 0; j != 60; ++j) {
      playerLast60SecCritAndDhData[j][0] = playerLast60SecCritAndDhData[prevIndex60][0];
      playerLast60SecCritAndDhData[j][1] = playerLast60SecCritAndDhData[prevIndex60][1];
      playerLast60SecCritAndDhData[j][2] = playerLast60SecCritAndDhData[prevIndex60][2];
      playerLast60SecCritAndDhData[j][3] = playerLast60SecCritAndDhData[prevIndex60][3];
    }
  }
}


function updateOverallCritAndDhData(playerParseData, playerOverallCritAndDhData, swings, critCount, dhCount, critDhCount) {
  if (!isNewEncounter) {
    playerOverallCritAndDhData[1][0] = swings;
    playerOverallCritAndDhData[1][1] = critCount;
    playerOverallCritAndDhData[1][2] = dhCount;
    playerOverallCritAndDhData[1][3] = critDhCount;
  }
  else {
    for(let i = 0; i != 4; ++i) 
    playerOverallCritAndDhData[0][i] += playerOverallCritAndDhData[1][i];
  }

  const overallCritChance = (critCount + playerOverallCritAndDhData[0][1]) / (swings + playerOverallCritAndDhData[0][0]);
  const overallDhChance = (dhCount + playerOverallCritAndDhData[0][2]) / (swings + playerOverallCritAndDhData[0][0]);
  const overallCritDhChance = (critDhCount + playerOverallCritAndDhData[0][3]) / (swings + playerOverallCritAndDhData[0][0]);
  
  playerParseData.overallCrit = overallCritChance;
  playerParseData.overallDh = overallDhChance;
  playerParseData.overallCritDh = overallCritDhChance;
  /*
  config.set('stats.overallCrit', overallCritChance);
  config.set('stats.overallDh', overallDhChance);
  config.set('stats.overallCritDh', overallCritDhChance);
  */
}


function updateLast60SecCritAndDhData(playerParseData, playerLast60SecCritAndDhData, swings, critCount, dhCount, critDhCount, durationDelta) {
  const last60CritChance = (critCount - playerLast60SecCritAndDhData[index60][1]) / (swings - playerLast60SecCritAndDhData[index60][0]);
  const last60DhChance = (dhCount - playerLast60SecCritAndDhData[index60][2]) / (swings - playerLast60SecCritAndDhData[index60][0]);
  const last60CritDhChance = (critDhCount - playerLast60SecCritAndDhData[index60][3]) / (swings - playerLast60SecCritAndDhData[index60][0]);
  
  playerParseData.last60Crit = last60CritChance;
  playerParseData.last60Dh = last60DhChance;
  playerParseData.last60CritDh = last60CritDhChance;

  let index = index60;
  for (let j = 0; j != durationDelta; ++j) {
    playerLast60SecCritAndDhData[index][0] = swings;
    playerLast60SecCritAndDhData[index][1] = critCount;
    playerLast60SecCritAndDhData[index][2] = dhCount;
    playerLast60SecCritAndDhData[index][3] = critDhCount;
    index = (index + 1) % 60;
  }
}


function updateAddedCritAndDhData(parseData, headerDuration, isActive) {
  let durationDelta = Math.max(headerDuration - lastKnownDuration, 1);
  if (durationDelta > 60) { 
    reinitLast60SecCritAndDhData();
    index60 = 0;
    durationDelta = 1;
  }
  
  for (let i = 0; i != parseData.length; ++i) {
    const playerName = parseData[i].name;
    const playerLast60SecCritAndDhData = last60SecCritAndDhData[playerName];
    const playerOverallCritAndDhData = overallCritAndDhData[playerName];
    const playerParseData = parseData[i];
    const swings = parseInt(playerParseData.swings);
    const critCount = parseInt(playerParseData.crithits);
    const dhCount = parseInt(playerParseData.DirectHitCount);
    const critDhCount = parseInt(playerParseData.CritDirectHitCount);

    updateLast60SecCritAndDhData(playerParseData, playerLast60SecCritAndDhData, swings, critCount, dhCount, critDhCount, durationDelta);
    updateOverallCritAndDhData(playerParseData, playerOverallCritAndDhData, swings, critCount, dhCount, critDhCount)
    if (playerName === "YOU")
      rngSoundHandler(parseData[i], swings, critCount, dhCount, critDhCount, isActive);
    
  }
  index60 = (index60 + durationDelta) % 60;
}


function rngSoundHandler(playerParseData, swings, critCount, dhCount, critDhCount, isActive) {
  const goodRngSfxConfig = config.get('sfx.good_rng');
  const badRngSfxConfig = config.get('sfx.bad_rng');

  if (isActive == 'false') {
    lastPlayedSound = -1;
    goodRngSfxConfig.should_resume ? goodRngSfx.pause() : goodRngSfx.stop();
    badRngSfxConfig.should_resume ? badRngSfx.pause() : badRngSfx.stop();
    return;
  }
  if (!(goodRngSfxConfig.enabled || badRngSfxConfig.enabled)) {
    goodRngSfx.stop();
    badRngSfx.stop()
    return;
  }

  const overallTriggerEnabled = config.get('sfx.trigger_on_overall');
  const currentTriggerEnabled = config.get('sfx.trigger_on_current');
  const last60TriggerEnabled = config.get('sfx.trigger_on_last60');

  const currentCritChance = critCount / swings;
  const currentDhChance = dhCount / swings;
  const currentCritDhChance = critDhCount / swings;
  const currentFightDeviation = (expectedCritChance - currentCritChance) + (expectedDhChance - currentDhChance) + (expectedCritDhChance - currentCritDhChance);
  const overallDeviation = (expectedCritChance - playerParseData.overallCrit) + (expectedDhChance - playerParseData.overallDh) + (expectedCritDhChance - playerParseData.overallCritDh);
  const last60Deviation = (expectedCritChance - playerParseData.last60Crit) + (expectedDhChance - playerParseData.last60Dh) + (expectedCritDhChance - playerParseData.last60CritDh);

  const isGoodRng = (overallTriggerEnabled && overallDeviation <= 0)
    || (currentTriggerEnabled && currentFightDeviation <= 0)
    || (last60TriggerEnabled && last60Deviation <= 0);

  if (isGoodRng && lastPlayedSound != 0) {
    badRngSfxConfig.should_resume ? badRngSfx.pause() : badRngSfx.stop();
    if (goodRngSfxConfig.enabled) goodRngSfx.play();
    lastPlayedSound = 0;
  }
  else if (!isGoodRng && lastPlayedSound != 1) {
    goodRngSfxConfig.should_resume ? goodRngSfx.pause() : goodRngSfx.stop();
    if (badRngSfxConfig.enabled) badRngSfx.play();
    lastPlayedSound = 1;
  }
}


;(function() {

  const NICK_REGEX = / \(([\uac00-\ud7a3']{1,9}|[A-Z][a-z' ]{0,15})\)$/

  const toArray = o => Object.keys(o).map(_ => o[_])
  const SORTABLE = {}

  COLUMN_SORTABLE.map(_ => {
    let o = resolveDotIndex(COLUMN_INDEX, _)
    SORTABLE[_] = o.v || o
  })

  class Data {
    constructor(data) {
      // reconstruct
      this.saveid = `kagerou_save_${Date.now()}` +
          sanitize(data.Encounter.CurrentZoneName)
      initSfx();
      this.update(data)
      this.isCurrent = true
    }

    update(data) {
      this.isActive = data.isActive
      this.header = data.Encounter
      this.data = toArray(data.Combatant)
      this.calculateMax(data.Combatant)
      
      updateUserDependentData();
      const duration = parseInt(this.header.DURATION);
      isNewEncounter = (lastSaveId !== this.saveid);
      if (isNewEncounter) {
        resetLast60SecCritAndDhData();
      }
      initAddedCritAndDhData(this.data);
      updateAddedCritAndDhData(this.data, duration, this.isActive);
      lastSaveId = this.saveid;
      lastKnownDuration = duration;
    }

    get(sort, merged) {
      let r = this.data.slice(0)

      if(merged) {
        let players = {}
        let haveYou = r.some(_ => _.name === 'YOU')

        for(let o of r) {
          let name = o.name
          let job = (o.Job || '').toUpperCase()
          let mergeable = VALID_PLAYER_JOBS.indexOf(job) === -1
          let owner = resolveOwner(name)
          let isUser = !owner && !mergeable

          if(haveYou && window.config.get('format.myname').indexOf(owner) != -1) {
            owner = 'YOU'
          }
          owner = owner || name

          if(!players[owner]) {
            players[owner] = Object.assign({}, o)
          } else {
            let patch = {}

            // let keys = Object.keys(players[owner])
            for(let k of COLUMN_MERGEABLE) {
              let v1 = pFloat(o[k])
              let v2 = pFloat(players[owner][k])
              patch[k] = (isNaN(v1)? 0 : v1) + (isNaN(v2)? 0 : v2)
            }

            for(let t in COLUMN_USE_LARGER) {
              let targets = COLUMN_USE_LARGER[t]
              let v
              let v1 = pInt(o[t])
              let v2 = pInt(players[owner][t])

              if(v1 > v2 || isNaN(v2))
                v = o
              else if(v1 <= v2 || isNaN(v1))
                v = players[owner]

              for(let k of targets) {
                patch[k] = v[k]
              }
            }

            if(isUser) {
              players[owner] = Object.assign({}, o, patch)
            } else {
              players[owner] = Object.assign({}, players[owner], patch)
            }
          }
        }
        r = toArray(players)
      }

      r = this.sort(sort, r)

      return [r, this.calculateMax(r)]
    }

    sort(key, target) {
      let d = (('+-'.indexOf(key[0]))+1 || 1) * 2 - 3
      let k = SORTABLE[key]
      ;(target || this.data).sort((a, b) => (pFloat(a[k]) - pFloat(b[k])) * d)

      if(target) return target
    }

    calculateMax(combatant) {
      let max = {}

      for(let k in SORTABLE) {
        let v = SORTABLE[k]
        max[k] = Math.max.apply(
          Math, Object.keys(combatant).map(_ => combatant[_][v])
        )
      }

      return max
    }

    finalize() {
      this.isCurrent = false
      return this.saveid
    }

  }

  class History {

    constructor() {
      this.lastEncounter = false
      this.currentData = false
      this.history = {}
    }

    push(data) {
      if(!data || !data.Encounter || data.Encounter.hits < 1) return

      if(this.isNewEncounter(data.Encounter)) {
        if(config.get('format.myname').length === 0
        && NICK_REGEX.test(data.Encounter.title)) {
          let nick = NICK_REGEX.exec(data.Encounter.title)[1]
          config.set('format.myname', [nick])
          config.save()
        }
        if(this.currentData) {
          let id = this.currentData.finalize()
          this.history[id] = {
            id: id,
            title: this.currentData.header.title,
            region: this.currentData.header.CurrentZoneName,
            duration: this.currentData.header.duration,
            dps: this.currentData.header.damage /
                 this.currentData.header.DURATION,
            data: this.currentData
          }
        }

        this.currentData = new Data(data)

      } else {
        this.currentData.update(data)
      }
    }

    updateLastEncounter(encounter) {
      this.lastEncounter = {
        hits: encounter.hits,
        region: encounter.CurrentZoneName,
        damage: encounter.damage,
        duration: parseInt(encounter.DURATION)
      }
    }

    isNewEncounter(encounter) {
      let really = (
        !this.lastEncounter
      || this.lastEncounter.region !== encounter.CurrentZoneName
      || this.lastEncounter.duration > parseInt(encounter.DURATION)
      // ACT-side bug (scrambling data) making this invalid!
      // || this.lastEncounter.damage > encounter.damage
      // || this.lastEncounter.hits > encounter.hits
      )
      this.updateLastEncounter(encounter)
      return really
    }

    get list() { return this.history }

    get current() { return this.currentData }

    browse(id) {
      return this.history[id]
    }
  }

  window.Data = Data
  window.History = History


})()



