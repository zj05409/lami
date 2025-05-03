// AI玩家逻辑模块
import { gameState, saveOriginalBoard, restoreOriginalBoard, addToBoard } from './gameState.js';
import { drawTileForPlayer, getTileDescription } from './deck.js';
import { sortPlayerRack, removeTilesFromRack } from './player.js';
import { validateBoard, checkGameEnd, isValidCombination, isSameNumberGroup, isRun, calculatePoints, MIN_FIRST_MOVE_POINTS } from './validation.js';

// AI回合
export function aiTurn(logMessage, updateUI) {
    if (!gameState.gameStarted) {
        gameState.aiAnimating = false; // 确保重置状态
        if (updateUI) updateUI();
        return;
    }

    // 如果不是AI的回合，立即返回并重置aiAnimating状态
    if (gameState.players[gameState.currentPlayer].isHuman) {
        gameState.aiAnimating = false; // 确保重置状态
        if (updateUI) updateUI();
        return;
    }

    // 当前AI玩家
    const aiPlayer = gameState.players[gameState.currentPlayer];

    // 记录开始AI回合
    logMessage(`轮到${aiPlayer.name}的回合`);

    // 如果棋盘有无效组合，禁止AI操作并重置aiAnimating状态
    if (!validateBoard()) {
        logMessage('游戏板上有无效的组合，无法继续游戏');
        gameState.aiAnimating = false; // 确保重置状态
        if (updateUI) updateUI();
        return;
    }

    // 设置AI动画状态
    gameState.aiAnimating = true;
    console.log(`${aiPlayer.name}回合开始，设置aiAnimating=true`);
    if (updateUI) updateUI(); // 更新UI，确保按钮状态正确

    // 延时执行AI行动，模拟思考
    setTimeout(() => {
        try {
            // 记录抽牌前牌架状态（用于调试）
            const oldRackSize = aiPlayer.rack.length;
            console.log(`${aiPlayer.name}抽牌前牌架数量: ${oldRackSize}`);

            // 尝试找出可能的组合或交互
            const aiPlan = createAIPlan(aiPlayer);
            let madeMove = false;
            let playedTiles = []; // 记录出的牌
            let actionDescription = ''; // 描述AI的行动
            let newGroups = 0; // 记录新创建的牌组数量

            // 保存棋盘原始状态（用于撤销）
            saveOriginalBoard();

            // 首先检查是否能执行行动
            if (aiPlan && aiPlan.length > 0) {
                // 记录AI要进行的操作
                console.log(`${aiPlayer.name}找到了${aiPlan.length}个可行动作`);

                // 处理不同类型的行动
                for (const action of aiPlan) {
                    if (Array.isArray(action)) {
                        // 这是一个新组合
                        addToBoard([...action]); // 添加到游戏板
                        // 从AI牌架中移除这些牌
                        removeTilesFromRack(aiPlayer, action);
                        playedTiles = playedTiles.concat(action);
                        newGroups++;

                        if (!actionDescription) {
                            actionDescription = '出了新组合';
                        }
                    }
                    else if (action.type === 'extend') {
                        // 这是向现有组合添加牌
                        const targetGroup = gameState.board[action.groupIndex];
                        const originalGroup = [...targetGroup]; // 保存原始组合用于验证

                        // 根据类型添加牌
                        if (action.isRun) {
                            // 创建一个新的临时组合进行验证
                            let newGroup = [...targetGroup];

                            // 添加到顺子的不同位置
                            if (action.position === 'start') {
                                newGroup = [...action.tiles, ...newGroup];
                            } else {
                                newGroup = [...newGroup, ...action.tiles];
                            }

                            // 验证新组合是否有效
                            if (isValidCombination(newGroup)) {
                                // 有效则应用到实际组合
                                if (action.position === 'start') {
                                    targetGroup.unshift(...action.tiles);
                                } else {
                                    targetGroup.push(...action.tiles);
                                }

                                // 从玩家牌架移除牌
                                removeTilesFromRack(aiPlayer, action.tiles);
                                playedTiles = playedTiles.concat(action.tiles);

                                if (!actionDescription || actionDescription === '出了新组合') {
                                    actionDescription = '扩展了现有组合';
                                } else {
                                    actionDescription = '出了新组合并扩展了现有组合';
                                }
                            } else {
                                // 无效则跳过此操作
                                console.warn(`AI尝试扩展顺子，但结果无效: `, {
                                    originalGroup: originalGroup.map(t => getTileDescription(t)),
                                    addedTiles: action.tiles.map(t => getTileDescription(t)),
                                    position: action.position
                                });
                                continue;
                            }
                        } else {
                            // 创建一个新的临时组合进行验证
                            const newGroup = [...targetGroup, ...action.tiles];

                            // 验证同数字组是否有效
                            if (isValidCombination(newGroup)) {
                                // 添加到同数字组
                                targetGroup.push(...action.tiles);

                                // 从玩家牌架移除牌
                                removeTilesFromRack(aiPlayer, action.tiles);
                                playedTiles = playedTiles.concat(action.tiles);

                                if (!actionDescription || actionDescription === '出了新组合') {
                                    actionDescription = '扩展了现有组合';
                                } else {
                                    actionDescription = '出了新组合并扩展了现有组合';
                                }
                            } else {
                                // 无效则跳过此操作
                                console.warn(`AI尝试扩展同数字组，但结果无效: `, {
                                    originalGroup: originalGroup.map(t => getTileDescription(t)),
                                    addedTiles: action.tiles.map(t => getTileDescription(t))
                                });
                                continue;
                            }
                        }
                    }
                    else if (action.type === 'replace_joker') {
                        // 这是用普通牌替换百搭牌
                        const group = gameState.board[action.groupIndex];
                        const originalGroup = [...group]; // 保存原始组合用于验证
                        const jokerPosition = action.jokerPositions[0]; // 简化：只替换第一个找到的百搭牌

                        // 获取百搭牌
                        const joker = group[jokerPosition];

                        // 创建一个新的临时组合进行验证
                        const newGroup = [...group];
                        newGroup[jokerPosition] = action.replacementTile;

                        // 验证替换后的组合是否有效
                        if (isValidCombination(newGroup)) {
                            // 替换百搭牌
                            group[jokerPosition] = action.replacementTile;

                            // 将百搭牌添加到AI牌架
                            aiPlayer.rack.push(joker);

                            // 从AI牌架移除用于替换的牌
                            removeTilesFromRack(aiPlayer, [action.replacementTile]);

                            // 记录交换的牌
                            playedTiles.push(action.replacementTile);
                            actionDescription = '替换了百搭牌';
                        } else {
                            // 无效则跳过此操作
                            console.warn(`AI尝试替换百搭牌，但结果无效: `, {
                                originalGroup: originalGroup.map(t => getTileDescription(t)),
                                replacementTile: getTileDescription(action.replacementTile),
                                jokerPosition
                            });
                            continue;
                        }
                    }
                    else if (action.type === 'extract_joker') {
                        // 这是直接取出不影响组合合法性的百搭牌
                        const group = gameState.board[action.groupIndex];

                        // 获取百搭牌
                        const joker = group[action.jokerPosition];

                        // 再次验证移除后的组合是否有效（以防期间发生变化）
                        if (isValidCombination(action.remainingGroup)) {
                            // 更新组合
                            gameState.board[action.groupIndex] = action.remainingGroup;

                            // 将百搭牌添加到AI牌架
                            aiPlayer.rack.push(joker);

                            // 没有从牌架中移除牌，所以playedTiles保持不变
                            actionDescription = '取出了百搭牌';
                        } else {
                            // 如果无效则跳过
                            console.warn(`AI尝试取出百搭牌，但结果无效`);
                            continue;
                        }
                    }
                    else if (action.type === 'reorganize') {
                        // 这是拆分和重组棋盘
                        if (action.action === 'split_run') {
                            // 拆分顺子
                            const sourceGroup = gameState.board[action.groupIndex];
                            const sortedGroup = [...sourceGroup].sort((a, b) => {
                                if (a.color === 'joker' || b.color === 'joker') return 0;
                                return a.number - b.number;
                            });

                            // 分成两组
                            const firstPart = sortedGroup.slice(0, action.splitIndex);
                            const secondPart = sortedGroup.slice(action.splitIndex);

                            // 添加玩家的牌
                            if (action.playerTile) {
                                // 根据策略决定添加到哪个部分
                                if (firstPart.length < secondPart.length) {
                                    firstPart.push(action.playerTile);
                                } else {
                                    secondPart.push(action.playerTile);
                                }

                                // 再次检验组合是否有效
                                if (!isValidCombination(firstPart) || !isValidCombination(secondPart)) {
                                    console.warn(`AI尝试拆分并重组牌组，但结果无效`);
                                    continue;
                                }

                                // 从玩家牌架移除牌
                                removeTilesFromRack(aiPlayer, [action.playerTile]);
                                playedTiles.push(action.playerTile);
                            }

                            // 最终验证两个新组合是否有效
                            if (isValidCombination(firstPart) && isValidCombination(secondPart)) {
                                // 移除原始组合
                                gameState.board.splice(action.groupIndex, 1);

                                // 添加两个新组合
                                addToBoard(firstPart);
                                addToBoard(secondPart);

                                actionDescription = '拆分并重组了牌组';
                            } else {
                                // 如无效则跳过
                                console.warn(`AI拆分重组后组合无效`);
                                continue;
                            }
                        }
                    }
                }

                // 最终验证整个棋盘
                if (!validateBoard()) {
                    // 如果棋盘存在无效组合，恢复原始状态
                    console.error("AI操作导致棋盘无效，恢复原始状态");
                    restoreOriginalBoard();

                    // 重置状态
                    playedTiles = [];
                    actionDescription = '';
                    madeMove = false;

                    // 记录错误
                    logMessage(`${aiPlayer.name}尝试修改棋盘，但产生了无效组合，操作被撤销`);
                } else {
                    // 计算出牌的总点数
                    let totalPoints = playedTiles.reduce((sum, tile) => {
                        return sum + (tile.color === 'joker' ? 30 : tile.number);
                    }, 0);

                    // 生成出牌的详细描述
                    const tileDescriptions = playedTiles.map(tile => getTileDescription(tile)).join('、');

                    // 标记首次出牌已完成（如果这是首次出牌且点数满足要求）
                    if (aiPlayer.firstMove && totalPoints >= MIN_FIRST_MOVE_POINTS) {
                        aiPlayer.firstMove = false;

                        // 提供更详细的首次出牌信息
                        if (newGroups > 0) {
                            logMessage(`${aiPlayer.name}首次出牌，出了${newGroups}组牌，共${playedTiles.length}张[${tileDescriptions}]，总点数${totalPoints}分`);
                        } else {
                            logMessage(`${aiPlayer.name}首次出牌，${actionDescription}，出了${playedTiles.length}张牌[${tileDescriptions}]，总点数${totalPoints}分`);
                        }
                    } else if (!aiPlayer.firstMove && playedTiles.length > 0) {
                        // 非首次出牌，没有点数限制
                        if (newGroups > 0 && actionDescription !== '出了新组合') {
                            logMessage(`${aiPlayer.name}${actionDescription}，共${playedTiles.length}张牌[${tileDescriptions}]，总点数${totalPoints}分`);
                        } else {
                            logMessage(`${aiPlayer.name}${actionDescription}，出了${playedTiles.length}张牌[${tileDescriptions}]，总点数${totalPoints}分`);
                        }
                    } else if (!aiPlayer.firstMove && playedTiles.length === 0 && actionDescription) {
                        // 只是重组了牌组但没有出牌
                        logMessage(`${aiPlayer.name}${actionDescription}`);
                    } else {
                        // 首次出牌但点数不够，需要抽牌
                        logMessage(`${aiPlayer.name}没有足够点数的组合(当前${totalPoints}分<${MIN_FIRST_MOVE_POINTS}分)，选择抽牌`);
                        // 重置棋盘（取消刚才的出牌）
                        restoreOriginalBoard();
                        const drawnTile = drawTileForPlayer(aiPlayer);
                        sortPlayerRack(aiPlayer);

                        // 记录抽到的牌
                        const tileDescription = drawnTile ? `（${getTileDescription(drawnTile)}）` : '';
                        logMessage(`${aiPlayer.name}抽了一张牌${tileDescription}`);
                    }

                    madeMove = playedTiles.length > 0 || actionDescription !== '';
                }
            }

            // 如果没有可行的出牌方案，就抽牌
            if (!madeMove) {
                const drawnTile = drawTileForPlayer(aiPlayer);

                // 检查抽牌是否成功
                if (drawnTile) {
                    // 对AI玩家的牌架进行排序
                    sortPlayerRack(aiPlayer);

                    // 记录抽到的牌（用于调试）
                    console.log(`${aiPlayer.name}抽到了${getTileDescription(drawnTile)}, 牌架现在有${aiPlayer.rack.length}张牌`);

                    // 记录抽到的牌
                    const tileDescription = drawnTile ? `（${getTileDescription(drawnTile)}）` : '';
                    logMessage(`${aiPlayer.name}抽了一张牌${tileDescription}`);
                } else {
                    console.warn(`${aiPlayer.name}抽牌失败，牌组可能已空`);
                    logMessage(`${aiPlayer.name}尝试抽牌，但牌组已空`);
                }
            }

            // 更新当前玩家
            gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

            // 立即更新UI反映状态变化
            if (updateUI) updateUI();

            // 再次验证棋盘有效性
            if (!validateBoard()) {
                console.error("严重错误：AI回合结束时棋盘仍然无效");
                logMessage("游戏板上有无效的组合，无法继续游戏");
                gameState.aiAnimating = false;
                if (updateUI) updateUI();
                return;
            }

            // 检查游戏是否结束
            const gameEndResult = checkGameEnd();
            if (gameEndResult.gameOver) {
                logMessage(`游戏结束！${gameEndResult.winnerName}赢了！`);
                gameState.aiAnimating = false;
                console.log('游戏结束，设置aiAnimating=false');
                if (updateUI) updateUI();
                return;
            }

            // 如果下一个玩家还是AI，则继续AI回合
            if (!gameState.players[gameState.currentPlayer].isHuman) {
                // 保持aiAnimating=true，继续AI回合
                console.log(`下一个玩家是${gameState.players[gameState.currentPlayer].name}，继续AI回合`);
                setTimeout(() => {
                    try {
                        aiTurn(logMessage, updateUI);
                    } catch (error) {
                        console.error('AI回合执行错误:', error);
                        gameState.aiAnimating = false; // 确保出错时也重置状态
                        if (updateUI) updateUI();
                    }
                }, 500);
            } else {
                // 如果下一个玩家是人类，结束AI动画状态
                gameState.aiAnimating = false;
                console.log('下一个玩家是人类，设置aiAnimating=false');
                if (updateUI) updateUI(); // 确保UI更新，显示正确的按钮状态
                logMessage('轮到你的回合了');
            }
        } catch (error) {
            // 捕获任何可能的错误，确保aiAnimating状态被重置
            console.error('AI回合执行错误:', error);
            gameState.aiAnimating = false;
            if (updateUI) updateUI();
        }
    }, 1000);
}

// AI寻找可能的移动（从牌架中找出可以组合的牌）
export function findPossibleMoves(player) {
    const moves = [];
    const rack = [...player.rack]; // 复制牌架以避免修改原始数据

    // 首先检查同数字组合
    findSameNumberGroups(rack, moves);

    // 然后检查顺子组合
    findRuns(rack, moves);

    // 只返回有效的组合
    return moves.filter(group => isValidCombination(group));
}

// 寻找与棋盘上现有牌组的可能交互
function findPossibleBoardInteractions(player) {
    // 如果棋盘上没有牌，则没有可能的交互
    if (gameState.board.length === 0) {
        return [];
    }

    const interactions = [];
    const rack = [...player.rack]; // 复制牌架

    // 尝试将牌架上的牌添加到棋盘上的现有组合中
    gameState.board.forEach((group, groupIndex) => {
        // 检查添加到顺子的可能性
        if (isRun(group)) {
            const color = group.find(tile => tile.color !== 'joker')?.color;
            if (!color) return; // 如果全是百搭牌，跳过

            // 找出玩家牌架上同样颜色的牌
            const matchingColorTiles = rack.filter(tile =>
                tile.color === color || tile.color === 'joker'
            );

            if (matchingColorTiles.length === 0) return; // 没有匹配的牌

            // 检查顺子两端扩展的可能性
            const sortedGroup = [...group].sort((a, b) => {
                // 对于百搭牌，需要特殊处理
                if (a.color === 'joker' || b.color === 'joker') {
                    // 这里简化处理，实际上需要根据顺子推断百搭牌代表的数字
                    return 0;
                }
                return a.number - b.number;
            });

            const minNumber = sortedGroup[0].color !== 'joker' ? sortedGroup[0].number :
                (sortedGroup.find(t => t.color !== 'joker')?.number || 0) - 1;

            const maxNumber = sortedGroup[sortedGroup.length - 1].color !== 'joker' ?
                sortedGroup[sortedGroup.length - 1].number :
                (sortedGroup.find(t => t.color !== 'joker')?.number || 0) + 1;

            // 检查每张可用的牌是否可以扩展顺子
            matchingColorTiles.forEach(tile => {
                // 向左扩展
                if (tile.color !== 'joker' && tile.number === minNumber - 1) {
                    interactions.push({
                        type: 'extend',
                        groupIndex,
                        tiles: [tile],
                        isRun: true,
                        position: 'start'
                    });
                }

                // 向右扩展
                if (tile.color !== 'joker' && tile.number === maxNumber + 1) {
                    interactions.push({
                        type: 'extend',
                        groupIndex,
                        tiles: [tile],
                        isRun: true,
                        position: 'end'
                    });
                }

                // 百搭牌可以放在任何位置
                if (tile.color === 'joker') {
                    interactions.push({
                        type: 'extend',
                        groupIndex,
                        tiles: [tile],
                        isRun: true,
                        position: 'any'
                    });
                }
            });

            // 检查是否可以替换百搭牌
            const jokerPositions = group.map((tile, index) => tile.color === 'joker' ? index : -1)
                .filter(index => index !== -1);

            // 如果组合中有百搭牌，检查是否可以替换
            if (jokerPositions.length > 0) {
                // 获取顺子的连续数字
                let numbers = [];
                let currentColor = null;

                // 分析顺子，推断百搭牌代表的数字
                for (let i = 0; i < sortedGroup.length; i++) {
                    const tile = sortedGroup[i];
                    if (tile.color !== 'joker') {
                        if (!currentColor) currentColor = tile.color;
                        numbers.push(tile.number);
                    }
                }

                // 排序数字以找出缺口
                numbers.sort((a, b) => a - b);

                // 推断百搭牌可能代表的数字
                const possibleJokerNumbers = [];
                if (numbers.length > 0) {
                    // 检查顺子内部的缺口
                    for (let i = 1; i < numbers.length; i++) {
                        const diff = numbers[i] - numbers[i - 1];
                        if (diff > 1) {
                            // 有缺口，百搭牌可能代表中间的数字
                            for (let j = 1; j < diff; j++) {
                                possibleJokerNumbers.push(numbers[i - 1] + j);
                            }
                        }
                    }

                    // 检查顺子两端的扩展
                    possibleJokerNumbers.push(numbers[0] - 1);
                    possibleJokerNumbers.push(numbers[numbers.length - 1] + 1);
                }

                // 检查玩家牌架是否有可以替换百搭牌的牌
                rack.forEach(tile => {
                    if (tile.color === currentColor && possibleJokerNumbers.includes(tile.number)) {
                        // 找到了可以替换百搭牌的牌
                        interactions.push({
                            type: 'replace_joker',
                            groupIndex,
                            replacementTile: tile,
                            jokerPositions: jokerPositions,
                            isRun: true
                        });
                    }
                });
            }
        }

        // 检查添加到同数字组的可能性
        else if (isSameNumberGroup(group)) {
            const nonJokers = group.filter(tile => tile.color !== 'joker');
            if (nonJokers.length === 0) return; // 如果全是百搭牌，跳过

            const targetNumber = nonJokers[0].number;
            const existingColors = new Set(nonJokers.map(tile => tile.color));

            // 如果组已经有4张牌，无法再添加
            if (group.length >= 4) return;

            // 寻找玩家牌架上相同数字但不同颜色的牌
            rack.forEach(tile => {
                if (tile.color === 'joker' ||
                    (tile.number === targetNumber && !existingColors.has(tile.color))) {
                    interactions.push({
                        type: 'extend',
                        groupIndex,
                        tiles: [tile],
                        isRun: false
                    });
                }
            });

            // 检查是否可以替换百搭牌
            const jokerPositions = group.map((tile, index) => tile.color === 'joker' ? index : -1)
                .filter(index => index !== -1);

            // 如果组合中有百搭牌，检查是否可以替换
            if (jokerPositions.length > 0) {
                // 检查玩家牌架是否有与目标数字相同但颜色不在现有组合中的牌
                rack.forEach(tile => {
                    if (tile.color !== 'joker' &&
                        tile.number === targetNumber &&
                        !existingColors.has(tile.color)) {
                        // 找到了可以替换百搭牌的牌
                        interactions.push({
                            type: 'replace_joker',
                            groupIndex,
                            replacementTile: tile,
                            jokerPositions: jokerPositions,
                            isRun: false
                        });
                    }
                });
            }
        }

        // 检查是否可以直接移除百搭牌（如果组合在没有百搭牌的情况下仍然合法）
        const jokers = group.filter(tile => tile.color === 'joker');
        if (jokers.length > 0) {
            // 尝试移除每个百搭牌并检查剩余组合是否仍然合法
            group.forEach((tile, index) => {
                if (tile.color === 'joker') {
                    // 创建移除一个百搭牌后的组合
                    const remainingGroup = [...group];
                    remainingGroup.splice(index, 1);

                    // 检查移除百搭牌后的组合是否仍然合法
                    if (isValidCombination(remainingGroup)) {
                        // 组合仍然合法，可以拿走百搭牌
                        interactions.push({
                            type: 'extract_joker',
                            groupIndex,
                            jokerPosition: index,
                            remainingGroup: remainingGroup
                        });
                    }
                }
            });
        }
    });

    return interactions;
}

// 尝试拆分和重组棋盘上的牌组
function findPossibleReorganizations(player) {
    if (gameState.board.length <= 1) {
        return []; // 少于两个牌组无法拆分重组
    }

    const result = [];
    const rack = [...player.rack];

    // 寻找可以拆分的顺子
    for (let groupIndex = 0; groupIndex < gameState.board.length; groupIndex++) {
        const group = gameState.board[groupIndex];

        // 只考虑顺子，因为同数字组无法拆分
        if (!isRun(group) || group.length < 5) continue; // 需要至少5张牌才值得拆分

        // 检查是否是顺子，并获取颜色和数字范围
        const nonJokers = group.filter(t => t.color !== 'joker');
        if (nonJokers.length === 0) continue;

        const color = nonJokers[0].color;
        const sortedTiles = [...nonJokers].sort((a, b) => a.number - b.number);

        // 尝试拆分长顺子，例如将 45678 拆成 456 和 78
        if (sortedTiles.length >= 5) {
            // 查找玩家手牌中是否有可以配合的牌
            const matchingTiles = rack.filter(t => t.color === color || t.color === 'joker');

            for (let i = 3; i <= sortedTiles.length - 3; i++) {
                // 检查玩家是否有可以补充到前半部分或后半部分的牌
                for (const tile of matchingTiles) {
                    // 检查是否能补充到前半部分
                    if (tile.color === 'joker' ||
                        tile.number === sortedTiles[0].number - 1 ||
                        tile.number === sortedTiles[i - 1].number + 1) {

                        result.push({
                            type: 'reorganize',
                            action: 'split_run',
                            groupIndex,
                            splitIndex: i,
                            playerTile: tile
                        });
                    }

                    // 检查是否能补充到后半部分
                    if (tile.color === 'joker' ||
                        tile.number === sortedTiles[i].number - 1 ||
                        tile.number === sortedTiles[sortedTiles.length - 1].number + 1) {

                        result.push({
                            type: 'reorganize',
                            action: 'split_run',
                            groupIndex,
                            splitIndex: i,
                            playerTile: tile
                        });
                    }
                }
            }
        }
    }

    return result;
}

// 寻找同数字组合
function findSameNumberGroups(rack, moves) {
    // 按数字分组
    const numberGroups = {};
    const jokers = rack.filter(tile => tile.color === 'joker');

    // 统计各数字的牌
    rack.forEach(tile => {
        if (tile.color !== 'joker') {
            if (!numberGroups[tile.number]) {
                numberGroups[tile.number] = [];
            }
            numberGroups[tile.number].push(tile);
        }
    });

    // 检查每个数字组
    Object.values(numberGroups).forEach(group => {
        // 过滤出不同颜色的牌
        const uniqueColorTiles = [];
        const colors = new Set();

        group.forEach(tile => {
            if (!colors.has(tile.color)) {
                colors.add(tile.color);
                uniqueColorTiles.push(tile);
            }
        });

        // 检查能否形成有效组合（需要3-4张不同颜色的牌）
        if (uniqueColorTiles.length >= 3) {
            // 可以直接使用3或4张不同颜色的牌
            moves.push(uniqueColorTiles.slice(0, Math.min(4, uniqueColorTiles.length)));
        } else if (uniqueColorTiles.length >= 2 && jokers.length > 0) {
            // 使用2张不同颜色的牌加1张百搭牌
            const combination = [...uniqueColorTiles, jokers[0]];
            moves.push(combination);
        } else if (uniqueColorTiles.length >= 1 && jokers.length >= 2) {
            // 使用1张牌加2张百搭牌
            const combination = [uniqueColorTiles[0], jokers[0], jokers[1]];
            moves.push(combination);
        }
    });
}

// 寻找顺子组合
function findRuns(rack, moves) {
    // 按颜色分组
    const colorGroups = {};
    const jokers = rack.filter(tile => tile.color === 'joker');

    rack.forEach(tile => {
        if (tile.color !== 'joker') {
            if (!colorGroups[tile.color]) {
                colorGroups[tile.color] = [];
            }
            colorGroups[tile.color].push(tile);
        }
    });

    // 对每种颜色的牌检查顺子
    Object.values(colorGroups).forEach(group => {
        // 按数字排序
        group.sort((a, b) => a.number - b.number);

        // 移除重复数字的牌
        const uniqueNumberTiles = [];
        const numbers = new Set();

        group.forEach(tile => {
            if (!numbers.has(tile.number)) {
                numbers.add(tile.number);
                uniqueNumberTiles.push(tile);
            }
        });

        // 检查连续的牌
        for (let i = 0; i < uniqueNumberTiles.length; i++) {
            const run = [uniqueNumberTiles[i]];
            let availableJokers = [...jokers]; // 可用的百搭牌

            // 向后检查连续牌
            for (let j = i + 1; j < uniqueNumberTiles.length; j++) {
                const gap = uniqueNumberTiles[j].number - run[run.length - 1].number - 1;

                // 没有空缺，直接添加
                if (gap === 0) {
                    run.push(uniqueNumberTiles[j]);
                }
                // 有空缺但有足够的百搭牌
                else if (gap > 0 && gap <= availableJokers.length) {
                    // 添加百搭牌填补空缺
                    for (let k = 0; k < gap; k++) {
                        run.push(availableJokers.shift());
                    }
                    run.push(uniqueNumberTiles[j]);
                }
                // 空缺太大或没有足够百搭牌
                else {
                    break;
                }
            }

            // 检查是否满足最小长度要求（3张）
            if (run.length >= 3) {
                moves.push(run);
            }
        }
    });
}

// 创建AI计划
export function createAIPlan(player) {
    // 如果是首次出牌，需要满足最低点数要求
    if (player.firstMove) {
        // 查找可能的自组合动作
        const possibleMoves = findPossibleMoves(player);

        // 如果没有可行动作，返回空数组
        if (possibleMoves.length === 0) {
            return [];
        }

        // 尝试找出单个组合就满足最低点数要求的方案
        const highScoreMoves = possibleMoves.filter(move =>
            calculatePoints(move) >= MIN_FIRST_MOVE_POINTS
        );

        if (highScoreMoves.length > 0) {
            // 按总点数排序并返回最高的
            highScoreMoves.sort((a, b) => calculatePoints(b) - calculatePoints(a));
            return [highScoreMoves[0]];
        }

        // 如果没有单个组合满足点数要求，尝试组合多个牌组
        // 按点数从高到低排序
        possibleMoves.sort((a, b) => calculatePoints(b) - calculatePoints(a));

        // 贪心算法：尽可能选择点数高的组合，直到总点数达到要求
        let selectedMoves = [];
        let totalPoints = 0;
        let usedTiles = new Set(); // 追踪已使用的牌，防止重复使用

        for (const move of possibleMoves) {
            // 检查是否与已选牌组有重叠（同一张牌不能用于多个组合）
            let hasOverlap = false;
            for (const tile of move) {
                if (usedTiles.has(tile.id)) {
                    hasOverlap = true;
                    break;
                }
            }

            if (!hasOverlap) {
                selectedMoves.push(move);
                totalPoints += calculatePoints(move);

                // 记录已使用的牌
                move.forEach(tile => usedTiles.add(tile.id));

                // 如果总点数已达到要求，返回选定的组合
                if (totalPoints >= MIN_FIRST_MOVE_POINTS) {
                    return selectedMoves;
                }
            }
        }

        // 如果尝试所有组合后仍未达到点数要求，则返回空
        return [];
    }

    // 非首次出牌，可以与棋盘交互
    // 1. 尝试找出从牌架组合的牌
    const possibleMoves = findPossibleMoves(player);

    // 2. 尝试找出与棋盘交互的可能性
    const possibleInteractions = findPossibleBoardInteractions(player);

    // 3. 尝试拆分和重组棋盘（这部分逻辑比较复杂，简化实现）
    const possibleReorganizations = findPossibleReorganizations(player);

    // 合并所有可能的行动
    let allPossibleActions = [];

    // 添加纯组合行动
    if (possibleMoves.length > 0) {
        // 按组合中牌数排序（优先出牌数多的）
        possibleMoves.sort((a, b) => b.length - a.length);
        allPossibleActions = allPossibleActions.concat(
            possibleMoves.slice(0, Math.min(3, possibleMoves.length))
                .map(move => ({ type: 'new_group', tiles: move }))
        );
    }

    // 添加棋盘交互行动
    if (possibleInteractions.length > 0) {
        // 按交互优先级排序
        possibleInteractions.sort((a, b) => {
            // 优先考虑取出或替换百搭牌的操作
            if (a.type === 'extract_joker' && b.type !== 'extract_joker') return -1;
            if (a.type !== 'extract_joker' && b.type === 'extract_joker') return 1;
            if (a.type === 'replace_joker' && b.type !== 'replace_joker') return -1;
            if (a.type !== 'replace_joker' && b.type === 'replace_joker') return 1;

            // 然后考虑可以扩展顺子的交互
            if (a.isRun && !b.isRun) return -1;
            if (!a.isRun && b.isRun) return 1;
            return 0;
        });

        // 选择前几个最优的交互
        const selectedInteractions = possibleInteractions.slice(0, Math.min(3, possibleInteractions.length));
        allPossibleActions = allPossibleActions.concat(selectedInteractions);
    }

    // 添加棋盘重组行动
    if (possibleReorganizations.length > 0) {
        allPossibleActions = allPossibleActions.concat(possibleReorganizations);
    }

    // 如果没有可能的行动，返回空数组
    if (allPossibleActions.length === 0) {
        return [];
    }

    // 根据策略选择最优行动
    // 新优先级：替换百搭牌 > 取出百搭牌 > 重组 > 交互 > 新组合
    const replaceJokerActions = allPossibleActions.filter(action => action.type === 'replace_joker');
    if (replaceJokerActions.length > 0) {
        return replaceJokerActions.slice(0, 1); // 每次只执行一次替换操作
    }

    const extractJokerActions = allPossibleActions.filter(action => action.type === 'extract_joker');
    if (extractJokerActions.length > 0) {
        return extractJokerActions.slice(0, 1); // 每次只执行一次取出操作
    }

    const reorganizationActions = allPossibleActions.filter(action => action.type === 'reorganize');
    if (reorganizationActions.length > 0) {
        return reorganizationActions;
    }

    const interactionActions = allPossibleActions.filter(action => action.type === 'extend');
    if (interactionActions.length > 0) {
        return interactionActions;
    }

    // 返回纯组合的行动
    return allPossibleActions
        .filter(action => action.type === 'new_group')
        .map(action => action.tiles);
} 