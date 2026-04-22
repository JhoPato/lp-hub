function parseScrimSense(raw) {
    const { matchInfo, players, teams, roundResults, kills: topKills, scrimTrackerMetadata } = raw;

    const ourColor   = scrimTrackerMetadata?.yourTeamIdOverride || 'Blue';
    const theirColor = ourColor === 'Blue' ? 'Red' : 'Blue';

    const ourTeam   = teams.find(t => t.teamId === ourColor)   || {};
    const theirTeam = teams.find(t => t.teamId === theirColor) || {};

    const scoreUs   = ourTeam.roundsWon   ?? 0;
    const scoreThem = theirTeam.roundsWon ?? 0;
    const result    = scoreUs > scoreThem ? 'W' : scoreUs < scoreThem ? 'L' : 'D';

    const subjectMap = {};
    players.forEach(p => {
        subjectMap[p.subject] = { ...p, isOurTeam: p.teamId === ourColor };
    });

    const killsByRound = {}; 
    topKills.forEach(k => {
        const r = k.round ?? 0;
        if (!killsByRound[r]) killsByRound[r] = [];
        killsByRound[r].push(k);
    });
    Object.values(killsByRound).forEach(arr => {
        arr.sort((a, b) => a.roundTime - b.roundTime);
    });

    const pStats = {};
    players.forEach(p => {
        pStats[p.subject] = {
            subject:           p.subject,
            gameName:          p.gameName,
            tagLine:           p.tagLine,
            isOurTeam:         p.teamId === ourColor,
            characterId:       p.characterId || '',
            hubPlayerId:       null,
            kills:             p.stats.kills,
            deaths:            p.stats.deaths,
            assists:           p.stats.assists,
            score:             p.stats.score,
            roundsPlayed:      p.stats.roundsPlayed,
            acs:               p.stats.roundsPlayed ? Math.round(p.stats.score / p.stats.roundsPlayed) : 0,
            kd:                p.stats.deaths ? parseFloat((p.stats.kills / p.stats.deaths).toFixed(2)) : p.stats.kills,
            kda:               p.stats.deaths ? parseFloat(((p.stats.kills + p.stats.assists) / p.stats.deaths).toFixed(2)) : (p.stats.kills + p.stats.assists),
            totalDamage:       0,
            headshotCount:     0,
            bodyshotCount:     0,
            legshotCount:      0,
            headshotPercent:   0,
            damagePerRound:    0,
            kastPercent:       0,
            firstKills:        0,
            firstDeaths:       0,
            mk2: 0, mk3: 0, mk4: 0, mk5: 0,
            clutchesAttempted: 0,
            clutchesWon:       0,
            avgLoadoutValue:   0,
            grenadeCasts:      p.stats.abilityCasts?.grenadeCasts  || 0,
            ability1Casts:     p.stats.abilityCasts?.ability1Casts || 0,
            ability2Casts:     p.stats.abilityCasts?.ability2Casts || 0,
            ultimateCasts:     p.stats.abilityCasts?.ultimateCasts || 0,
        };
    });

    const kastRounds = {};
    players.forEach(p => { kastRounds[p.subject] = new Set(); });

    const loadoutSamples = {};
    players.forEach(p => { loadoutSamples[p.subject] = []; });

    let ourAttackRoundsWon = 0, ourAttackRoundsPlayed = 0;
    let ourDefenseRoundsWon = 0, ourDefenseRoundsPlayed = 0;

    const parsedRounds = roundResults.map(r => {
        const roundNum   = r.roundNum;
        const ourTeamWon = r.winningTeam === ourColor;
        const rKills     = killsByRound[roundNum] || [];

        const winnerRole = r.winningTeamRole; 
        const ourRole    = ourTeamWon ? winnerRole : (winnerRole === 'Attacker' ? 'Defender' : 'Attacker');

        if (ourRole === 'Attacker') {
            ourAttackRoundsPlayed++;
            if (ourTeamWon) ourAttackRoundsWon++;
        } else {
            ourDefenseRoundsPlayed++;
            if (ourTeamWon) ourDefenseRoundsWon++;
        }

        const deadSubjects = new Set(rKills.map(k => k.victim));

        if (rKills.length > 0) {
            const fk = rKills[0]; 
            if (pStats[fk.killer]) pStats[fk.killer].firstKills++;
            if (pStats[fk.victim]) pStats[fk.victim].firstDeaths++;
        }

        rKills.forEach(k => {
            if (kastRounds[k.killer]) kastRounds[k.killer].add(roundNum);
            (k.assistants || []).forEach(a => {
                if (kastRounds[a]) kastRounds[a].add(roundNum);
            });
        });

        players.forEach(p => {
            if (!deadSubjects.has(p.subject) && kastRounds[p.subject]) {
                kastRounds[p.subject].add(roundNum);
            }
        });

        rKills.forEach(kill => {
            const victimTeam = subjectMap[kill.victim]?.teamId;
            const tradeKill  = rKills.find(k2 =>
                k2.victim === kill.killer &&
                subjectMap[k2.killer]?.teamId === victimTeam &&
                k2.roundTime >= kill.roundTime &&
                k2.roundTime <= kill.roundTime + 5000
            );
            if (tradeKill && kastRounds[kill.victim]) {
                kastRounds[kill.victim].add(roundNum);
            }
        });

        const roundKillCount = {};
        rKills.forEach(k => {
            roundKillCount[k.killer] = (roundKillCount[k.killer] || 0) + 1;
        });
        Object.entries(roundKillCount).forEach(([subject, count]) => {
            if (!pStats[subject]) return;
            if      (count === 2) pStats[subject].mk2++;
            else if (count === 3) pStats[subject].mk3++;
            else if (count === 4) pStats[subject].mk4++;
            else if (count >= 5)  pStats[subject].mk5++;
        });

        const ourAlive   = new Set(players.filter(p => p.teamId === ourColor).map(p => p.subject));
        const theirAlive = new Set(players.filter(p => p.teamId === theirColor).map(p => p.subject));
        let clutchSubject = null;

        for (const k of rKills) {
            const victimTeam = subjectMap[k.victim]?.teamId;
            if (victimTeam === ourColor)   ourAlive.delete(k.victim);
            else                           theirAlive.delete(k.victim);

            if (ourAlive.size === 1 && theirAlive.size >= 2 && !clutchSubject) {
                clutchSubject = [...ourAlive][0];
                if (pStats[clutchSubject]) pStats[clutchSubject].clutchesAttempted++;
            }
        }
        if (clutchSubject && ourTeamWon && pStats[clutchSubject]) {
            pStats[clutchSubject].clutchesWon++;
        }

        const playerRoundStats = [];
        (r.playerStats || []).forEach(ps => {
            let totalDmg = 0, hs = 0, bs = 0, ls = 0;
            (ps.damage || []).forEach(d => {
                totalDmg += d.damage  || 0;
                hs       += d.headshots || 0;
                bs       += d.bodyshots || 0;
                ls       += d.legshots  || 0;
            });

            if (pStats[ps.subject]) {
                pStats[ps.subject].totalDamage   += totalDmg;
                pStats[ps.subject].headshotCount += hs;
                pStats[ps.subject].bodyshotCount += bs;
                pStats[ps.subject].legshotCount  += ls;
            }

            if (ps.economy?.loadoutValue && loadoutSamples[ps.subject]) {
                loadoutSamples[ps.subject].push(ps.economy.loadoutValue);
            }

            playerRoundStats.push({
                subject:      ps.subject,
                kills:        (ps.kills || []).length,
                damage:       totalDmg,
                headshots:    hs,
                bodyshots:    bs,
                legshots:     ls,
                score:        ps.score || 0,
                survived:     !deadSubjects.has(ps.subject),
                loadoutValue: ps.economy?.loadoutValue || 0,
                weaponId:     ps.economy?.weapon || '',
                armorId:      ps.economy?.armor  || '',
                spent:        ps.economy?.spent || 0,
                remaining:    ps.economy?.remaining || 0,
                abilityCasts: {
                    grenade:  ps.ability?.grenadeEffects  != null,
                    ability1: ps.ability?.ability1Effects != null,
                    ability2: ps.ability?.ability2Effects != null,
                    ultimate: ps.ability?.ultimateEffects != null,
                },
            });
        });

        return {
            roundNum,
            result:             r.roundResult,
            winnerTeam:         r.winningTeam,
            winnerRole:         r.winningTeamRole,
            ourTeamWon,
            plantSite:          r.plantSite    || null,
            plantRoundTime:     r.plantRoundTime   || 0,
            defuseRoundTime:    r.defuseRoundTime   || 0,
            firstKillerSubject: rKills[0]?.killer || null,
            firstVictimSubject: rKills[0]?.victim  || null,
            playerStats:        playerRoundStats,
        };
    });

    const totalRounds = roundResults.length;
    players.forEach(p => {
        const ps    = pStats[p.subject];
        const shots = ps.headshotCount + ps.bodyshotCount + ps.legshotCount;

        ps.headshotPercent = shots > 0
            ? parseFloat(((ps.headshotCount / shots) * 100).toFixed(1))
            : 0;
        ps.damagePerRound = totalRounds > 0
            ? parseFloat((ps.totalDamage / totalRounds).toFixed(1))
            : 0;

        const kastCount  = kastRounds[p.subject]?.size || 0;
        ps.kastPercent   = totalRounds > 0
            ? parseFloat(((kastCount / totalRounds) * 100).toFixed(1))
            : 0;

        const lv = loadoutSamples[p.subject] || [];
        ps.avgLoadoutValue = lv.length > 0
            ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length)
            : 0;
    });

    const parsedKills = topKills.map(k => ({
        roundNum:           k.round ?? 0,
        roundTime:          k.roundTime,
        killer:             k.killer,
        victim:             k.victim,
        assistants:         k.assistants || [],
        weaponId:           k.finishingDamage?.damageItem || '',
        isFirstKillOfRound: (killsByRound[k.round ?? 0]?.[0]?.gameTime === k.gameTime),
        playerLocations:    (() => {
            const locs = (k.playerLocations || []).map(pl => ({
                subject:     pl.subject,
                viewRadians: pl.viewRadians || 0,
                location:    { x: pl.location?.x || 0, y: pl.location?.y || 0 },
            }));
            if (k.victim && k.victimLocation && !locs.find(pl => pl.subject === k.victim)) {
                locs.push({ subject: k.victim, viewRadians: 0, location: { x: k.victimLocation.x || 0, y: k.victimLocation.y || 0 } });
            }
            return locs;
        })(),
    }));

    return {
        matchId:               matchInfo.matchId,
        mapId:                 matchInfo.mapId || '',
        mapName:               null,
        gameVersion:           matchInfo.gameVersion || '',
        gameStartMillis:       matchInfo.gameStartMillis,
        gameLengthMillis:      matchInfo.gameLengthMillis,
        date:                  new Date(matchInfo.gameStartMillis),
        ourTeamColor:          ourColor,
        result,
        scoreUs,
        scoreThem,
        opponent:              '',
        ourAttackRoundsWon,
        ourAttackRoundsPlayed,
        ourDefenseRoundsWon,
        ourDefenseRoundsPlayed,
        players:               Object.values(pStats),
        rounds:                parsedRounds,
        kills:                 parsedKills,
    };
}

module.exports = parseScrimSense;
