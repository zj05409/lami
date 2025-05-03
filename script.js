// 游戏常量
const COLORS = ['red', 'blue', 'yellow', 'black'];
const MAX_NUMBER = 13;
const JOKER_COUNT = 2;
const INITIAL_TILES = 14;
const MIN_FIRST_MOVE_POINTS = 30; // 首次出牌最低点数
const AI_MOVE_DELAY = 300; // AI移动牌的延迟(毫秒)
const AI_ANIMATION_DURATION = 400; // AI移动动画时长(毫秒)

// 游戏状态
let gameState = {
    deck: [],
    board: [], // 数组中每个元素是一个组合（顺子或同数字组）
    selectedTiles: [], // 当前选中的牌
    tempBoard: null, // 临时存储修改中的棋盘
    validMove: false, // 当前移动是否有效
    currentPlayer: 0, // 0 = 人类玩家, 1-3 = AI玩家
    players: [
        { name: '玩家', rack: [], isHuman: true, firstMove: true },
        { name: 'AI 1', rack: [], isHuman: false, firstMove: true },
        { name: 'AI 2', rack: [], isHuman: false, firstMove: true },
        { name: 'AI 3', rack: [], isHuman: false, firstMove: true }
    ],
    gameStarted: false,
    draggedTile: null, // 正在拖拽的牌
    dragSourceType: null, // 拖拽源类型: 'rack', 'board'
    dragSourceIndex: -1, // 拖拽源索引
    boardModified: false, // 棋盘是否被修改过
    originalBoard: null, // 用于存储原始棋盘状态，以便在无效操作时恢复
    aiAnimating: false, // 是否正在进行AI动画
    animationQueue: [], // AI动作队列
    interventionAIPlayer: null, // 当前干预的AI玩家
    humanInterventionMode: false, // 是否启用人类干预模式
    aiCombinedFirstMove: false, // 是否是首次出牌的组合行动
    aiTotalPoints: 0 // 首次出牌的总点数
};

// DOM元素
const boardEl = document.getElementById('board');
const playerRackEl = document.getElementById('player-rack');
const aiRacks = [
    document.getElementById('ai1-rack'),
    document.getElementById('ai2-rack'),
    document.getElementById('ai3-rack')
];
const startGameBtn = document.getElementById('start-game');
const drawTileBtn = document.getElementById('draw-tile');
const endTurnBtn = document.getElementById('end-turn');
const messagesEl = document.getElementById('messages');

// 初始化事件监听
startGameBtn.addEventListener('click', startGame);
drawTileBtn.addEventListener('click', drawTile);
endTurnBtn.addEventListener('click', endTurn);

// 禁用初始时不需要的按钮
drawTileBtn.disabled = true;
endTurnBtn.disabled = true;

// 初始化游戏
function initGame() {
    gameState.deck = [];
    gameState.board = [];
    gameState.selectedTiles = [];
    gameState.tempBoard = null;
    gameState.validMove = false;
    gameState.currentPlayer = 0;
    gameState.draggedTile = null;
    gameState.dragSourceType = null;
    gameState.dragSourceIndex = -1;
    gameState.boardModified = false;
    gameState.originalBoard = null;
    gameState.aiAnimating = false;
    gameState.animationQueue = [];
    gameState.interventionAIPlayer = null;
    gameState.humanInterventionMode = false;

    // 重置玩家状态
    gameState.players.forEach(player => {
        player.rack = [];
        player.firstMove = true;
    });

    // 创建牌组
    // 每种颜色2套数字1-13
    COLORS.forEach(color => {
        for (let number = 1; number <= MAX_NUMBER; number++) {
            gameState.deck.push({ color, number, id: `${color}-${number}-1` });
            gameState.deck.push({ color, number, id: `${color}-${number}-2` });
        }
    });

    // 添加百搭牌
    for (let i = 0; i < JOKER_COUNT; i++) {
        gameState.deck.push({ color: 'joker', number: 0, id: `joker-${i}` });
    }

    // 洗牌
    shuffleDeck();

    // 更新界面
    updateUI();

    logMessage('游戏已初始化，请点击开始游戏按钮');
}

// 洗牌
function shuffleDeck() {
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
}

// 开始游戏
function startGame() {
    if (gameState.gameStarted) {
        logMessage('游戏已经开始');
        return;
    }

    initGame();
    gameState.gameStarted = true;

    // 发牌给所有玩家
    gameState.players.forEach(player => {
        for (let i = 0; i < INITIAL_TILES; i++) {
            drawTileForPlayer(player);
        }
    });

    // 按数字排序玩家的牌
    gameState.players.forEach(player => {
        sortPlayerRack(player);
    });

    // 更新UI
    updateUI();

    // 启用按钮
    startGameBtn.disabled = true;
    drawTileBtn.disabled = false;
    endTurnBtn.disabled = false;

    logMessage('游戏开始! 轮到你出牌了');
}

// 保存棋盘状态
function saveOriginalBoard() {
    // 深拷贝当前棋盘状态
    gameState.originalBoard = JSON.parse(JSON.stringify(gameState.board));
}

// 恢复棋盘状态
function restoreOriginalBoard() {
    if (gameState.originalBoard) {
        gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
        gameState.originalBoard = null;
        gameState.boardModified = false;
        updateUI();
    }
}

// 抽牌
function drawTile() {
    if (!gameState.gameStarted) {
        logMessage('请先开始游戏');
        return;
    }

    if (gameState.currentPlayer !== 0) {
        logMessage('现在不是你的回合');
        return;
    }

    if (gameState.deck.length === 0) {
        logMessage('牌组已空');
        return;
    }

    // 如果棋盘被修改过，但处于无效状态，提示用户先恢复
    if (gameState.boardModified && !validateBoard()) {
        if (confirm('棋盘处于无效状态，需要恢复到原始状态才能抽牌。是否恢复？')) {
            restoreOriginalBoard();
        } else {
            return;
        }
    }

    const currentPlayer = gameState.players[gameState.currentPlayer];
    drawTileForPlayer(currentPlayer);
    sortPlayerRack(currentPlayer);

    updateUI();

    // 记录抽到的牌是什么
    const lastDrawnTile = currentPlayer.rack[currentPlayer.rack.length - 1];
    const tileDescription = lastDrawnTile ? `（${getTileDescription(lastDrawnTile)}）` : '';

    // 延长延时执行endTurn，确保UI更新完成
    setTimeout(() => {
        logMessage(`你抽了一张牌${tileDescription}，回合结束`);

        // 更新当前玩家
        gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

        // 更新UI
        updateUI();

        // 检查游戏是否结束
        if (checkGameEnd()) {
            return;
        }

        // 进一步延时，确保UI完全更新后再执行AI回合
        setTimeout(() => {
            // AI玩家的回合
            aiTurn();
        }, 300);
    }, 500);

    return;
}

// 为指定玩家抽牌
function drawTileForPlayer(player) {
    if (gameState.deck.length > 0) {
        const tile = gameState.deck.pop();
        player.rack.push(tile);
    }
}

// 结束回合
function endTurn() {
    if (!gameState.gameStarted) {
        logMessage('请先开始游戏');
        return;
    }

    if (gameState.currentPlayer !== 0) {
        logMessage('现在不是你的回合');
        return;
    }

    // 检查所有牌组是否合法
    if (!validateBoard()) {
        logMessage('游戏板上有无效的组合，请调整后再结束回合');
        return;
    }

    // 检查是否修改了棋盘
    if (gameState.boardModified && gameState.originalBoard) {
        // 获取原始棋盘状态（回合开始时的状态）
        const originalGroups = gameState.originalBoard || [];

        // 计算当前回合玩家放置的牌的总点数
        let totalPoints = 0;
        let newGroupCount = 0;

        if (originalGroups.length === 0) {
            // 如果原来棋盘为空，所有当前牌组都是新放置的
            gameState.board.forEach(group => {
                // 计算每个组的点数
                let groupPoints = 0;
                group.forEach(tile => {
                    if (tile.color === 'joker') {
                        groupPoints += 30; // 百搭牌算30分
                    } else {
                        groupPoints += tile.number;
                    }
                });
                totalPoints += groupPoints;
                newGroupCount++;
            });
        } else {
            // 比较原始棋盘和当前棋盘，计算新增牌的点数

            // 先检查新增的牌组
            for (let i = 0; i < gameState.board.length; i++) {
                // 检查这个组是否是新增的（原始棋盘中不存在）
                let isNewGroup = i >= originalGroups.length;

                if (isNewGroup) {
                    // 新增的整组
                    let groupPoints = 0;
                    gameState.board[i].forEach(tile => {
                        if (tile.color === 'joker') {
                            groupPoints += 30; // 百搭牌算30分
                        } else {
                            groupPoints += tile.number;
                        }
                    });
                    totalPoints += groupPoints;
                    newGroupCount++;
                } else {
                    // 比较原有组中是否添加了新牌
                    const originalGroup = originalGroups[i];
                    const currentGroup = gameState.board[i];

                    // 检查该组是否有新增的牌
                    if (currentGroup.length > originalGroup.length) {
                        // 找出新增的牌
                        const originalIds = new Set(originalGroup.map(tile => tile.id));
                        const newTiles = currentGroup.filter(tile => !originalIds.has(tile.id));

                        // 计算新增牌的点数
                        let addedPoints = 0;
                        newTiles.forEach(tile => {
                            if (tile.color === 'joker') {
                                addedPoints += 30; // 百搭牌算30分
                            } else {
                                addedPoints += tile.number;
                            }
                        });
                        totalPoints += addedPoints;
                    }
                }
            }
        }

        // 使用辅助函数生成并输出详细信息
        const detailedLog = getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, true);
        logMessage(detailedLog);

        // 如果是首次出牌，需要检查点数
        if (gameState.players[0].firstMove) {
            if (totalPoints < MIN_FIRST_MOVE_POINTS) {
                logMessage(`首次出牌总点数需要至少${MIN_FIRST_MOVE_POINTS}点，当前只有${totalPoints}点`);
                return;
            }

            // 更新首次出牌状态
            gameState.players[0].firstMove = false;
        }
    }

    // 重置棋盘修改状态
    gameState.boardModified = false;
    gameState.originalBoard = null;

    // 更新当前玩家
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    // 更新UI
    updateUI();

    // 检查游戏是否结束
    if (checkGameEnd()) {
        return;
    }

    // AI玩家的回合
    aiTurn();
}

// 从玩家牌架移除牌
function removeTilesFromRack(player, tiles) {
    tiles.forEach(tile => {
        const index = player.rack.findIndex(t => t.id === tile.id);
        if (index !== -1) {
            player.rack.splice(index, 1);
        }
    });
}

// 将牌添加到游戏板
function addToBoard(tiles) {
    // 将牌添加为新的组合
    gameState.board.push([...tiles]);
}

// AI玩家的回合
function aiTurn() {
    if (gameState.aiAnimating) return; // 如果正在动画中，不执行

    while (gameState.currentPlayer !== 0 && !gameState.aiAnimating) {
        const currentPlayer = gameState.players[gameState.currentPlayer];

        logMessage(`${currentPlayer.name}的回合`);

        // 保存棋盘原始状态，用于复杂操作
        if (gameState.board.length > 0) {
            saveOriginalBoard();
        }

        // 创建AI行动计划
        const aiPlan = createAIPlan(currentPlayer);

        if (aiPlan.actions.length > 0) {
            // AI有可行动作，执行
            gameState.aiAnimating = true;
            gameState.animationQueue = [...aiPlan.actions];

            // 记录组合出牌信息
            if (aiPlan.isCombinedFirstMove) {
                gameState.aiCombinedFirstMove = true;
                gameState.aiTotalPoints = aiPlan.totalPoints;
            } else {
                gameState.aiCombinedFirstMove = false;
                gameState.aiTotalPoints = 0;
            }

            // 执行第一个动作
            setTimeout(() => executeNextAIAction(), AI_MOVE_DELAY);
            return; // 中断循环，等待完成
        } else {
            // AI没有可行动作，询问人类玩家是否要替AI出牌
            if (confirmHumanIntervention(currentPlayer)) {
                return; // 人类选择替AI出牌，中断当前AI回合流程
            }

            // 人类选择不干预，AI抽牌
            if (gameState.deck.length > 0) {
                drawTileForPlayer(currentPlayer);
                sortPlayerRack(currentPlayer);
                // 记录抽到的牌是什么
                const lastDrawnTile = currentPlayer.rack[currentPlayer.rack.length - 1];
                const tileDescription = lastDrawnTile ? `（${getTileDescription(lastDrawnTile)}）` : '';
                logMessage(`${currentPlayer.name}抽了一张牌${tileDescription}`);
            } else {
                logMessage(`牌组已空，${currentPlayer.name}无法抽牌`);
            }

            // 如果有原始棋盘状态，恢复它以防止牌组消失
            if (gameState.originalBoard) {
                gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
                // 恢复后立即更新UI，确保用户能看到原始棋盘状态
                updateUI();
                // 清除原始棋盘状态，避免影响下一个玩家
                gameState.originalBoard = null;
            }

            // 下一个玩家
            gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

            // 更新UI
            updateUI();

            // 游戏结束检查
            if (checkGameEnd()) {
                return;
            }
        }
    }

    if (!gameState.aiAnimating) {
        logMessage('轮到你的回合了');
    }
}

// 执行下一个AI动作
function executeNextAIAction() {
    if (gameState.animationQueue.length === 0) {
        // 所有动作完成
        completeAITurn();
        return;
    }

    const action = gameState.animationQueue.shift();

    // 根据动作类型执行
    switch (action.type) {
        case 'move_to_board':
            executeAIMoveToBoard(action);
            break;
        case 'move_between_groups':
            executeAIMoveBetweenGroups(action);
            break;
        case 'create_new_group':
            executeAICreateNewGroup(action);
            break;
        default:
            // 执行下一个动作
            setTimeout(() => executeNextAIAction(), 300);
    }
}

// 执行AI将牌从手牌移到游戏板的动作
function executeAIMoveToBoard(action) {
    const { playerIndex, tileIndex, targetGroupIndex } = action;

    // 获取牌和目标组
    const tile = gameState.players[playerIndex].rack[tileIndex];

    if (!tile) {
        // 如果找不到牌，跳过当前动作，执行下一个
        console.warn('找不到要移动的牌', playerIndex, tileIndex);
        setTimeout(() => executeNextAIAction(), 300);
        return;
    }

    // 从玩家牌架中移除牌
    const tileMoved = gameState.players[playerIndex].rack.splice(tileIndex, 1)[0];

    // 添加到游戏板
    if (targetGroupIndex === -1 || targetGroupIndex >= gameState.board.length) {
        // 创建新组 - 单张牌不是有效组合，所以不应该单独创建牌组
        if (isValidCombination([tileMoved])) {
            gameState.board.push([tileMoved]);
            // 即使只有一张牌，也需要排序，以便将来添加更多牌时能正确排列
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            console.warn('AI尝试创建只有一张牌的非法组合，已取消操作');
            // 将牌放回AI的牌架
            gameState.players[playerIndex].rack.push(tileMoved);
            sortPlayerRack(gameState.players[playerIndex]);
        }
    } else {
        // 添加到现有组 - 检查添加后是否仍然是有效组合
        const testGroup = [...gameState.board[targetGroupIndex], tileMoved];
        if (isValidCombination(testGroup)) {
            // 如果有效，添加到现有组
            gameState.board[targetGroupIndex].push(tileMoved);
            // 排序牌组
            sortGroup(gameState.board[targetGroupIndex]);
        } else {
            console.warn('添加牌后组合变为非法，已取消操作');
            // 将牌放回AI的牌架
            gameState.players[playerIndex].rack.push(tileMoved);
            sortPlayerRack(gameState.players[playerIndex]);
        }
    }

    // 更新界面
    updateUI();

    // 执行下一个动作
    setTimeout(() => executeNextAIAction(), 300);
}

// 执行AI将牌在游戏板上的组之间移动的动作
function executeAIMoveBetweenGroups(action) {
    const { sourceGroupIndex, tileIndex, targetGroupIndex } = action;

    // 检查索引是否有效
    if (sourceGroupIndex < 0 || sourceGroupIndex >= gameState.board.length ||
        tileIndex < 0 || tileIndex >= gameState.board[sourceGroupIndex].length) {
        console.warn('无效的源牌位置', sourceGroupIndex, tileIndex);
        setTimeout(() => executeNextAIAction(), 300);
        return;
    }

    // 保存原始组（用于在操作失败时恢复）
    const originalSourceGroup = [...gameState.board[sourceGroupIndex]];

    // 取出牌
    const tileMoved = gameState.board[sourceGroupIndex].splice(tileIndex, 1)[0];

    // 检查源组在移除该牌后是否仍然合法（如果源组还有牌）
    let sourceGroupStillValid = true;
    if (gameState.board[sourceGroupIndex].length > 0) {
        sourceGroupStillValid = isValidCombination(gameState.board[sourceGroupIndex]);
    }

    // 如果源组不再合法，恢复原始状态
    if (!sourceGroupStillValid) {
        console.warn('从源组移除牌后，源组变为非法组合，已取消操作');
        // 恢复源组
        gameState.board[sourceGroupIndex] = originalSourceGroup;
        setTimeout(() => executeNextAIAction(), 300);
        return;
    }

    // 如果源组为空，移除
    let sourceGroupRemoved = false;
    if (gameState.board[sourceGroupIndex].length === 0) {
        gameState.board.splice(sourceGroupIndex, 1);
        sourceGroupRemoved = true;
    }

    // 添加到目标组
    if (targetGroupIndex === -1 || targetGroupIndex >= gameState.board.length) {
        // 创建新组 - 单张牌不是有效组合
        if (isValidCombination([tileMoved])) {
            gameState.board.push([tileMoved]);
        } else {
            console.warn('AI尝试创建只有一张牌的非法组合，已取消操作');

            // 恢复原始状态
            if (sourceGroupRemoved) {
                // 如果源组已被移除，重新添加
                gameState.board.splice(sourceGroupIndex, 0, originalSourceGroup);
            } else {
                // 否则恢复源组
                gameState.board[sourceGroupIndex] = originalSourceGroup;
            }
        }
    } else {
        // 计算调整后的目标索引
        let adjustedTargetIndex = targetGroupIndex;
        if (sourceGroupRemoved && sourceGroupIndex < targetGroupIndex) {
            adjustedTargetIndex--;
        }

        // 检查添加到目标组后是否仍然合法
        const testTargetGroup = [...gameState.board[adjustedTargetIndex], tileMoved];

        if (isValidCombination(testTargetGroup)) {
            // 添加到目标组
            gameState.board[adjustedTargetIndex].push(tileMoved);
            // 排序牌组
            sortGroup(gameState.board[adjustedTargetIndex]);
        } else {
            console.warn('添加牌后目标组变为非法，已取消操作');

            // 恢复原始状态
            if (sourceGroupRemoved) {
                // 如果源组已被移除，重新添加
                gameState.board.splice(sourceGroupIndex, 0, originalSourceGroup);
            } else {
                // 否则恢复源组
                gameState.board[sourceGroupIndex] = originalSourceGroup;
            }
        }
    }

    // 更新界面
    updateUI();

    // 执行下一个动作
    setTimeout(() => executeNextAIAction(), 300);
}

// 执行AI创建新组的动作
function executeAICreateNewGroup(action) {
    const { tiles, sourceIndices } = action;

    // 检查参数是否有效
    if (!tiles || !sourceIndices || tiles.length === 0 || sourceIndices.length === 0 ||
        tiles.length !== sourceIndices.length) {
        console.warn('无效的AI创建新组参数', action);
        setTimeout(() => executeNextAIAction(), AI_MOVE_DELAY);
        return;
    }

    // 验证即将创建的牌组是否合法
    if (!isValidCombination(tiles)) {
        console.warn('AI尝试创建非法牌组:', tiles);
        setTimeout(() => executeNextAIAction(), AI_MOVE_DELAY);
        return;
    }

    // 创建牌组的副本（因为后面可能会修改原有对象）
    const tilesToAdd = [];

    // 从AI玩家牌架中移除这些牌并收集它们
    // 从后往前遍历，避免索引变化问题
    const sortedIndices = [...sourceIndices].sort((a, b) => b - a); // 降序排序

    for (const index of sortedIndices) {
        if (index >= 0 && index < gameState.players[gameState.currentPlayer].rack.length) {
            // 从玩家牌架中移除这张牌
            const removedTile = gameState.players[gameState.currentPlayer].rack.splice(index, 1)[0];
            if (removedTile) {
                // 通过ID匹配，找到对应的原始牌对象
                const originalTile = tiles.find(t => t.id === removedTile.id);
                if (originalTile) {
                    tilesToAdd.push(removedTile);
                }
            }
        }
    }

    // 对添加的牌进行排序，确保它们的顺序正确
    // 先创建一个映射表，将ID映射到原始顺序
    const orderMap = new Map();
    tiles.forEach((tile, index) => {
        orderMap.set(tile.id, index);
    });

    // 根据原始顺序对收集的牌进行排序
    tilesToAdd.sort((a, b) => {
        return orderMap.get(a.id) - orderMap.get(b.id);
    });

    // 只有在实际收集到牌的情况下才创建新组
    if (tilesToAdd.length > 0) {
        // 再次验证收集到的牌是否构成有效组合
        if (isValidCombination(tilesToAdd)) {
            // 添加到游戏板
            gameState.board.push(tilesToAdd);
            // 立即对新创建的牌组进行排序，确保百搭牌位于正确位置
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            console.warn('AI在执行中创建了非法牌组，已跳过添加操作', tilesToAdd);
            // 将牌放回AI的牌架
            gameState.players[gameState.currentPlayer].rack.push(...tilesToAdd);
            sortPlayerRack(gameState.players[gameState.currentPlayer]);
        }
    }

    // 更新界面
    updateUI();

    // 延迟一下执行下一个动作，保证界面更新完成
    setTimeout(() => executeNextAIAction(), AI_MOVE_DELAY);
}

// 完成AI回合
function completeAITurn() {
    const currentPlayer = gameState.players[gameState.currentPlayer];

    // 检查游戏板上是否有非法组合
    let invalidGroupFound = false;
    for (const group of gameState.board) {
        if (!isValidCombination(group)) {
            invalidGroupFound = true;
            console.warn('AI创建了非法牌组:', group);
            break;
        }
    }

    // 如果发现非法组合，撤销操作
    if (invalidGroupFound) {
        logMessage(`${currentPlayer.name}出现了非法操作，正在恢复棋盘状态`);

        // 撤销操作，恢复棋盘
        if (gameState.originalBoard) {
            gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
        }

        // 抽一张牌
        if (gameState.deck.length > 0) {
            drawTileForPlayer(currentPlayer);
            sortPlayerRack(currentPlayer);
            logMessage(`${currentPlayer.name}抽了一张牌`);
        } else {
            logMessage(`牌组已空，${currentPlayer.name}无法抽牌`);
        }

        // 更新当前玩家
        gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

        // 重置动画状态
        gameState.aiAnimating = false;
        gameState.animationQueue = [];

        // 清除原始棋盘状态，避免影响下一个玩家
        gameState.originalBoard = null;

        // 重置组合首次出牌状态
        gameState.aiCombinedFirstMove = false;
        gameState.aiTotalPoints = 0;

        // 更新界面
        updateUI();

        // 检查游戏是否结束
        if (checkGameEnd()) {
            return;
        }

        // 继续执行下一个AI的回合或转到玩家回合
        setTimeout(() => aiTurn(), 300);
        return;
    }

    // 处理组合首次出牌的情况
    if (gameState.aiCombinedFirstMove && currentPlayer.firstMove) {
        // 使用已经计算好的总点数
        const totalPoints = gameState.aiTotalPoints;

        // 获取原始棋盘状态（回合开始时的状态）
        const originalGroups = gameState.originalBoard || [];

        // 计算新增的牌组数量
        let newGroupCount = 0;
        if (originalGroups.length === 0) {
            newGroupCount = gameState.board.length;
        } else {
            newGroupCount = gameState.board.length - originalGroups.length;
        }

        // 使用辅助函数生成并输出详细信息
        const detailedLog = getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, false).replace('AI', currentPlayer.name);
        logMessage(detailedLog);

        // 检查总点数是否达到要求
        if (totalPoints >= MIN_FIRST_MOVE_POINTS) {
            currentPlayer.firstMove = false;
            logMessage(`${currentPlayer.name}首次出牌完成，总点数：${totalPoints}`);
        } else {
            // 如果点数不足（不应该发生，因为已经在createAIPlan中检查过），撤销操作
            logMessage(`${currentPlayer.name}首次出牌点数不足，需要至少${MIN_FIRST_MOVE_POINTS}点，当前只有${totalPoints}点`);

            // 恢复棋盘状态
            if (gameState.originalBoard) {
                logMessage(`恢复${currentPlayer.name}的棋盘状态`);
                gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
            } else {
                gameState.board = [];
            }

            // 抽一张牌
            if (gameState.deck.length > 0) {
                drawTileForPlayer(currentPlayer);
                sortPlayerRack(currentPlayer);
                const lastDrawnTile = currentPlayer.rack[currentPlayer.rack.length - 1];
                const tileDescription = lastDrawnTile ? `（${getTileDescription(lastDrawnTile)}）` : '';
                logMessage(`${currentPlayer.name}抽了一张牌${tileDescription}`);
            } else {
                logMessage(`牌组已空，${currentPlayer.name}无法抽牌`);
            }

            updateUI();
        }

        // 重置组合首次出牌状态
        gameState.aiCombinedFirstMove = false;
        gameState.aiTotalPoints = 0;
    }
    // 如果不是组合首次出牌，但是首次出牌，检查总点数并更新状态
    else if (currentPlayer.firstMove && gameState.board.length > 0) {
        // 获取原始棋盘状态（回合开始时的状态）
        const originalGroups = gameState.originalBoard || [];

        // 计算AI当前回合放置的牌的总点数
        let totalPoints = 0;
        let newGroupCount = 0;

        // 跟踪AI新放置的所有牌，用于在点数不足时返还
        const newTiles = [];

        if (originalGroups.length === 0) {
            // 如果原来棋盘为空，所有当前牌组都是新放置的
            gameState.board.forEach(group => {
                // 收集所有新放置的牌
                newTiles.push(...group);

                // 计算每个组的点数
                let groupPoints = 0;
                group.forEach(tile => {
                    if (tile.color === 'joker') {
                        groupPoints += 30; // 百搭牌算30分
                    } else {
                        groupPoints += tile.number;
                    }
                });
                totalPoints += groupPoints;
                newGroupCount++;
            });
        } else {
            // 比较原始棋盘和当前棋盘，计算新增牌的点数

            // 先检查新增的牌组
            for (let i = 0; i < gameState.board.length; i++) {
                // 检查这个组是否是新增的（原始棋盘中不存在）
                let isNewGroup = i >= originalGroups.length;

                if (isNewGroup) {
                    // 新增的整组
                    newTiles.push(...gameState.board[i]);

                    // 计算每个组的点数
                    let groupPoints = 0;
                    gameState.board[i].forEach(tile => {
                        if (tile.color === 'joker') {
                            groupPoints += 30; // 百搭牌算30分
                        } else {
                            groupPoints += tile.number;
                        }
                    });
                    totalPoints += groupPoints;
                    newGroupCount++;
                } else {
                    // 比较原有组中是否添加了新牌
                    const originalGroup = originalGroups[i];
                    const currentGroup = gameState.board[i];

                    // 检查该组是否有新增的牌
                    if (currentGroup.length > originalGroup.length) {
                        // 找出新增的牌
                        const originalIds = new Set(originalGroup.map(tile => tile.id));
                        const addedTiles = currentGroup.filter(tile => !originalIds.has(tile.id));

                        // 收集新增的牌
                        newTiles.push(...addedTiles);

                        // 计算新增牌的点数
                        let addedPoints = 0;
                        addedTiles.forEach(tile => {
                            if (tile.color === 'joker') {
                                addedPoints += 30; // 百搭牌算30分
                            } else {
                                addedPoints += tile.number;
                            }
                        });
                        totalPoints += addedPoints;
                    }
                }
            }
        }

        // 使用辅助函数生成并输出AI详细信息
        const detailedLog = getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, false).replace('AI', currentPlayer.name);
        logMessage(detailedLog);

        // 只有当总点数达到要求时才更新首次出牌状态
        if (totalPoints >= MIN_FIRST_MOVE_POINTS) {
            currentPlayer.firstMove = false;
            logMessage(`${currentPlayer.name}首次出牌完成，总点数：${totalPoints}`);
        } else {
            // 如果点数不足，需要撤销操作并抽牌
            logMessage(`${currentPlayer.name}首次出牌点数不足，需要至少${MIN_FIRST_MOVE_POINTS}点，当前只有${totalPoints}点`);

            // 撤销操作前，先将这些新放置的牌返回到AI的手牌中
            if (newTiles.length > 0) {
                // 将收集到的新牌添加回AI手牌
                currentPlayer.rack.push(...newTiles);
                sortPlayerRack(currentPlayer);

                // 显示的消息可以根据返回了多少牌进行调整
                logMessage(`将${newTiles.length}张牌返回到${currentPlayer.name}的手牌`);
            }

            // 恢复棋盘状态
            if (gameState.originalBoard) {
                // 先显示一条消息，告诉用户将恢复棋盘状态
                logMessage(`恢复${currentPlayer.name}的棋盘状态`);

                // 恢复棋盘状态
                gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));

                // 强制更新UI，确保显示恢复的棋盘状态
                updateUI();
            } else {
                // 如果没有原始棋盘状态（第一次出牌时棋盘为空），则清空棋盘
                gameState.board = [];
                updateUI();
            }

            // 抽一张牌
            if (gameState.deck.length > 0) {
                drawTileForPlayer(currentPlayer);
                sortPlayerRack(currentPlayer);
                // 记录抽到的牌是什么
                const lastDrawnTile = currentPlayer.rack[currentPlayer.rack.length - 1];
                const tileDescription = lastDrawnTile ? `（${getTileDescription(lastDrawnTile)}）` : '';
                logMessage(`${currentPlayer.name}抽了一张牌${tileDescription}`);
            } else {
                logMessage(`牌组已空，${currentPlayer.name}无法抽牌`);
            }
        }
    } else if (gameState.originalBoard) {
        // 非首次出牌，但仍需记录详细日志
        const originalGroups = gameState.originalBoard || [];

        // 计算AI当前回合放置的牌的总点数
        let totalPoints = 0;
        let newGroupCount = 0;

        // 比较原始棋盘和当前棋盘，计算新增牌和牌组
        if (originalGroups.length === 0) {
            // 如果原来棋盘为空，所有当前牌组都是新放置的
            gameState.board.forEach(group => {
                // 计算每个组的点数
                let groupPoints = 0;
                group.forEach(tile => {
                    if (tile.color === 'joker') {
                        groupPoints += 30; // 百搭牌算30分
                    } else {
                        groupPoints += tile.number;
                    }
                });
                totalPoints += groupPoints;
                newGroupCount++;
            });
        } else {
            // 计算新增的牌组和牌
            // 先检查新增的牌组
            for (let i = 0; i < gameState.board.length; i++) {
                let isNewGroup = i >= originalGroups.length;

                if (isNewGroup) {
                    // 新增的整组
                    let groupPoints = 0;
                    gameState.board[i].forEach(tile => {
                        if (tile.color === 'joker') {
                            groupPoints += 30; // 百搭牌算30分
                        } else {
                            groupPoints += tile.number;
                        }
                    });
                    totalPoints += groupPoints;
                    newGroupCount++;
                } else {
                    // 比较原有组中是否添加了新牌
                    const originalGroup = originalGroups[i];
                    const currentGroup = gameState.board[i];

                    // 检查该组是否有新增的牌
                    if (currentGroup.length > originalGroup.length) {
                        // 找出新增的牌
                        const originalIds = new Set(originalGroup.map(tile => tile.id));
                        const newTiles = currentGroup.filter(tile => !originalIds.has(tile.id));

                        // 计算新增牌的点数
                        let addedPoints = 0;
                        newTiles.forEach(tile => {
                            if (tile.color === 'joker') {
                                addedPoints += 30; // 百搭牌算30分
                            } else {
                                addedPoints += tile.number;
                            }
                        });
                        totalPoints += addedPoints;
                    }
                }
            }
        }

        // 只记录详细信息，不做其他处理
        const detailedLog = getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, false).replace('AI', currentPlayer.name);
        logMessage(detailedLog);
    }

    // 更新当前玩家
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    // 重置动画状态
    gameState.aiAnimating = false;
    gameState.animationQueue = [];

    // 清除原始棋盘状态，避免影响下一个玩家
    gameState.originalBoard = null;

    // 重置组合首次出牌状态
    gameState.aiCombinedFirstMove = false;
    gameState.aiTotalPoints = 0;

    // 更新界面
    updateUI();

    // 检查游戏是否结束
    if (checkGameEnd()) {
        return;
    }

    // 继续进行下一个AI的回合或转到玩家回合
    setTimeout(() => aiTurn(), 300);
}

// 创建AI行动计划
function createAIPlan(player) {
    // 复杂策略：先尝试组合手中的牌，然后尝试拆分和重组游戏板上的组合

    // 创建一个计划对象
    const plan = {
        actions: [],
        isCombinedFirstMove: false,
        totalPoints: 0
    };

    // 尝试直接从手牌中找出可出的组合
    const directMoves = findPossibleMoves(player);

    // 判断是否是首次出牌
    if (!player.firstMove || gameState.board.length > 0) {
        // 非首次出牌，或游戏板上已有牌组（可以直接添加到现有牌组）

        // 尝试直接出牌
        if (directMoves.length > 0) {
            // 对可能的移动按点数降序排序，优先选择高分牌组
            directMoves.sort((a, b) => calculatePoints(b) - calculatePoints(a));

            // 选择一个最优的移动（避免重复创建多个组合）
            const bestMove = directMoves[0];
            // 排序移动的牌
            sortMoveCards(bestMove);
            // 创建一个动作并返回
            plan.actions.push(createNewGroupAction(player, bestMove));
            return plan;
        }
    } else {
        // 首次出牌，需要计算总点数

        // 先按点数降序排序所有可能的移动
        directMoves.sort((a, b) => calculatePoints(b) - calculatePoints(a));

        // 如果最高分移动已经满足要求，只用它
        if (directMoves.length > 0 && calculatePoints(directMoves[0]) >= MIN_FIRST_MOVE_POINTS) {
            const bestMove = directMoves[0];
            sortMoveCards(bestMove);
            plan.actions.push(createNewGroupAction(player, bestMove));
            // 记录总点数
            plan.totalPoints = calculatePoints(bestMove);
            return plan;
        }

        // 否则尝试找出点数总和满足要求的组合
        const selectedMoves = [];
        let totalPoints = 0;

        for (const move of directMoves) {
            // 确保不重复使用牌（例如，如果有多个使用相同牌的组合）
            const moveIds = move.map(tile => tile.id);
            const alreadyUsedTile = selectedMoves.some(selectedMove =>
                selectedMove.some(tile => moveIds.includes(tile.id))
            );

            if (!alreadyUsedTile) {
                selectedMoves.push(move);
                // 计算每个移动的点数并添加到总点数
                totalPoints += calculatePoints(move);

                // 排序移动的牌
                sortMoveCards(move);

                if (totalPoints >= MIN_FIRST_MOVE_POINTS) {
                    break; // 已经达到要求
                }
            }
        }

        // 如果总点数达到要求
        if (totalPoints >= MIN_FIRST_MOVE_POINTS) {
            // 为每个选中的移动创建动作
            for (const move of selectedMoves) {
                plan.actions.push(createNewGroupAction(player, move));
            }

            // 确保记录这是一个组合行动，以便在completeAITurn中正确处理
            plan.isCombinedFirstMove = true;
            plan.totalPoints = totalPoints;

            return plan;
        }
        // 如果无法达到点数要求，继续尝试其他策略
    }

    // 如果无法直接出牌，尝试将牌添加到现有牌组
    if (gameState.board.length > 0) {
        // 创建游戏板的副本进行模拟操作
        const originalBoard = JSON.parse(JSON.stringify(gameState.board));
        // 创建玩家牌架的副本
        const originalRack = JSON.parse(JSON.stringify(player.rack));

        // 遍历玩家手牌
        for (let i = 0; i < player.rack.length; i++) {
            const tile = player.rack[i];

            // 尝试将牌添加到每个现有牌组
            for (let groupIndex = 0; groupIndex < gameState.board.length; groupIndex++) {
                const group = [...gameState.board[groupIndex]];

                // 尝试添加到现有组
                const testGroup = [...group, tile];
                if (isValidCombination(testGroup)) {
                    // 创建动作：将牌移动到现有组
                    plan.actions.push({
                        type: 'move_to_board',
                        playerIndex: gameState.currentPlayer,
                        tileIndex: i,
                        targetGroupIndex: groupIndex
                    });

                    // 更新模拟状态
                    gameState.board[groupIndex].push({ ...tile });
                    player.rack.splice(i, 1);

                    // 递归调用，继续寻找下一个可行动作
                    const nextPlan = createAIPlan(player);
                    plan.actions.push(...nextPlan.actions);

                    // 恢复游戏状态
                    gameState.board = JSON.parse(JSON.stringify(originalBoard));
                    player.rack = JSON.parse(JSON.stringify(originalRack));

                    return plan;
                }
            }
        }

        // 恢复游戏状态
        gameState.board = JSON.parse(JSON.stringify(originalBoard));
        player.rack = JSON.parse(JSON.stringify(originalRack));
    }

    // 最后尝试重组游戏板上的组合
    // 这部分逻辑比较复杂，暂时不实现

    // 如果无法出牌，返回空计划
    return plan;
}

// 辅助函数：排序移动的牌
function sortMoveCards(move) {
    if (isRun(move)) {
        // 如果是顺子，按数字排序
        move.sort((a, b) => {
            if (a.color === 'joker') return -1;
            if (b.color === 'joker') return 1;
            return a.number - b.number;
        });
    } else {
        // 如果是同数字组，按颜色排序
        move.sort((a, b) => {
            if (a.color === 'joker') return -1;
            if (b.color === 'joker') return 1;
            return a.color.localeCompare(b.color);
        });
    }
}

// 辅助函数：创建新组动作
function createNewGroupAction(player, move) {
    return {
        type: 'create_new_group',
        tiles: [...move],
        sourceIndices: move.map(tile => player.rack.findIndex(t => t.id === tile.id))
    };
}

// 辅助函数：从玩家牌架中移除牌并添加到游戏板
function removeAndAddToBoard(player, move) {
    // 从玩家牌架中移除这些牌
    move.forEach(tile => {
        const index = player.rack.findIndex(t => t.id === tile.id);
        if (index !== -1) {
            player.rack.splice(index, 1);
        }
    });

    // 添加到游戏板
    gameState.board.push([...move]);
}

// 查找可能的移动（从手牌中找出所有可能的有效组合）
function findPossibleMoves(player) {
    const rack = [...player.rack];
    const moves = [];

    // 对牌架进行排序，以便更容易找出组合
    rack.sort((a, b) => {
        if (a.color === 'joker') return -1;
        if (b.color === 'joker') return 1;
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.number - b.number;
    });

    // 将牌按花色分组
    const colorGroups = {};
    const jokers = [];
    rack.forEach(tile => {
        if (tile.color === 'joker') {
            jokers.push(tile);
        } else {
            if (!colorGroups[tile.color]) {
                colorGroups[tile.color] = [];
            }
            colorGroups[tile.color].push(tile);
        }
    });

    // 查找所有颜色的顺子
    for (const color in colorGroups) {
        const colorTiles = [...colorGroups[color]];

        // 按数字排序
        colorTiles.sort((a, b) => a.number - b.number);

        // 找出长度为3或以上的顺子
        findRuns(colorTiles, jokers).forEach(run => {
            if (run.length >= 3) {
                moves.push(run);
            }
        });
    }

    // 查找同数字组合
    const numberGroups = {};
    rack.forEach(tile => {
        if (tile.color !== 'joker') {
            if (!numberGroups[tile.number]) {
                numberGroups[tile.number] = [];
            }
            numberGroups[tile.number].push(tile);
        }
    });

    // 对于每个数字，找出可能的同数字组合
    for (const number in numberGroups) {
        const numberTiles = numberGroups[number];
        const colors = new Set(numberTiles.map(tile => tile.color));

        // 如果有3个或更多不同颜色的同数字牌，直接添加
        if (colors.size >= 3) {
            // 确保选择的牌颜色各不相同
            const uniqueColorTiles = [];
            const usedColors = new Set();

            for (const tile of numberTiles) {
                if (!usedColors.has(tile.color)) {
                    uniqueColorTiles.push(tile);
                    usedColors.add(tile.color);
                }
            }

            moves.push(uniqueColorTiles);
        }

        // 如果有2个不同颜色的同数字牌，考虑使用百搭牌
        else if (colors.size === 2 && jokers.length > 0) {
            const group = [...numberTiles, jokers[0]];
            moves.push(group);
        }
    }

    return moves;
}

// 辅助函数：查找所有可能的顺子
function findRuns(tiles, jokers) {
    if (tiles.length === 0) return [];

    const runs = [];
    const availableJokers = [...jokers];

    // 首先寻找不使用百搭牌的顺子
    for (let start = 0; start < tiles.length; start++) {
        let currentRun = [tiles[start]];
        let expectedNumber = tiles[start].number + 1;

        for (let i = start + 1; i < tiles.length; i++) {
            // 如果出现重复数字，跳过
            if (tiles[i].number === expectedNumber - 1) continue;

            // 处理连续的牌
            if (tiles[i].number === expectedNumber) {
                currentRun.push(tiles[i]);
                expectedNumber++;
            }
            // 处理不连续的牌，如果有足够的百搭牌可以填补缺口
            else if (tiles[i].number > expectedNumber) {
                const gap = tiles[i].number - expectedNumber;
                if (availableJokers.length >= gap) {
                    // 填补缺口
                    for (let j = 0; j < gap; j++) {
                        if (availableJokers.length > 0) {
                            currentRun.push(availableJokers.shift());
                        }
                    }
                    currentRun.push(tiles[i]);
                    expectedNumber = tiles[i].number + 1;
                } else {
                    // 缺口太大，无法填补，结束当前顺子
                    break;
                }
            }
        }

        // 检查是否形成了至少3张牌的顺子
        if (currentRun.length >= 3) {
            runs.push([...currentRun]);
        }

        // 恢复百搭牌
        availableJokers.length = 0;
        availableJokers.push(...jokers);
    }

    // 尝试使用百搭牌开始的顺子
    if (availableJokers.length > 0 && tiles.length >= 2) {
        // 对于每个可能的起始数字
        for (let startNum = 1; startNum <= MAX_NUMBER - 2; startNum++) {
            let currentRun = [];
            let jokersUsed = 0;
            let expectedNumber = startNum;

            // 构建顺子
            for (let i = 0; i < tiles.length && expectedNumber <= MAX_NUMBER; i++) {
                // 如果当前牌的数字小于预期数字，跳过
                if (tiles[i].number < expectedNumber) continue;

                // 如果有缺口，尝试用百搭牌填补
                while (expectedNumber < tiles[i].number && jokersUsed < availableJokers.length) {
                    currentRun.push(availableJokers[jokersUsed]);
                    jokersUsed++;
                    expectedNumber++;
                }

                // 如果当前牌的数字等于预期数字，添加到顺子中
                if (tiles[i].number === expectedNumber) {
                    currentRun.push(tiles[i]);
                    expectedNumber++;
                }
                // 如果有缺口但没有足够的百搭牌，结束当前顺子
                else if (tiles[i].number > expectedNumber) {
                    break;
                }
            }

            // 检查是否形成了至少3张牌的顺子
            if (currentRun.length >= 3) {
                runs.push([...currentRun]);
            }
        }
    }

    return runs;
}

// 按数字排序玩家的牌
function sortPlayerRack(player) {
    player.rack.sort((a, b) => {
        if (a.color === 'joker') return -1;
        if (b.color === 'joker') return 1;
        if (a.color !== b.color) return a.color.localeCompare(b.color);
        return a.number - b.number;
    });
}

// 检查是否为有效组合
function isValidCombination(tiles) {
    if (tiles.length < 3) {
        return false; // 至少需要3张牌
    }

    // 检查是否是同数字组(至少3个相同数字不同颜色)
    if (isSameNumberGroup(tiles)) {
        return true;
    }

    // 检查是否是顺子(至少3个连续数字相同颜色)
    if (isRun(tiles)) {
        return true;
    }

    return false;
}

// 检查是否是同数字组
function isSameNumberGroup(tiles) {
    // 排除百搭牌
    const nonJokers = tiles.filter(tile => tile.color !== 'joker');
    const jokerCount = tiles.length - nonJokers.length;

    // 没有非百搭牌则无法形成组合
    if (nonJokers.length === 0) {
        return false;
    }

    // 检查所有非百搭牌是否都是同一数字
    const number = nonJokers[0].number;
    const allSameNumber = nonJokers.every(tile => tile.number === number);

    if (!allSameNumber) {
        return false;
    }

    // 检查颜色是否互不相同
    const colors = nonJokers.map(tile => tile.color);
    const uniqueColors = new Set(colors);

    return uniqueColors.size + jokerCount >= 3 && uniqueColors.size === nonJokers.length;
}

// 检查是否是顺子
function isRun(tiles) {
    // 排除百搭牌
    const nonJokers = tiles.filter(tile => tile.color !== 'joker');
    const jokerCount = tiles.length - nonJokers.length;

    // 没有非百搭牌则无法形成组合
    if (nonJokers.length === 0) {
        return false;
    }

    // 检查所有非百搭牌是否都是同一颜色
    const color = nonJokers[0].color;
    const allSameColor = nonJokers.every(tile => tile.color === color);

    if (!allSameColor) {
        return false;
    }

    // 对非百搭牌按数字排序
    nonJokers.sort((a, b) => a.number - b.number);

    // 记录非百搭牌的数字，用于确定百搭牌的实际含义
    const actualNumbers = nonJokers.map(tile => tile.number);

    // 检查是否是连续的数字，可以使用百搭牌填补空缺
    let jokerUsed = 0;
    for (let i = 1; i < nonJokers.length; i++) {
        const gap = nonJokers[i].number - nonJokers[i - 1].number - 1;
        if (gap > 0) {
            if (jokerUsed + gap <= jokerCount) {
                jokerUsed += gap;
            } else {
                return false; // 百搭牌不够填补空缺
            }
        } else if (gap < 0) {
            return false; // 数字不是递增的
        }
    }

    // 确保总共至少有3张牌
    return nonJokers.length + jokerCount >= 3;
}

// 计算组合的点数（用于首次出牌）
function calculatePoints(tiles) {
    return tiles.reduce((sum, tile) => {
        if (tile.color === 'joker') {
            return sum + 30; // 百搭牌算30分
        }
        return sum + tile.number;
    }, 0);
}

// 验证游戏板上所有组合的合法性
function validateBoard() {
    if (gameState.board.length === 0) {
        return true;
    }

    for (const group of gameState.board) {
        if (!isValidCombination(group)) {
            return false;
        }
    }

    return true;
}

// 检查游戏是否结束
function checkGameEnd() {
    for (const player of gameState.players) {
        if (player.rack.length === 0) {
            logMessage(`游戏结束! ${player.name}获胜!`);
            gameState.gameStarted = false;
            startGameBtn.disabled = false;
            drawTileBtn.disabled = true;
            endTurnBtn.disabled = true;
            return true;
        }
    }

    if (gameState.deck.length === 0) {
        let minTiles = Infinity;
        let winner = null;

        for (const player of gameState.players) {
            if (player.rack.length < minTiles) {
                minTiles = player.rack.length;
                winner = player;
            }
        }

        if (winner) {
            logMessage(`牌组已空! ${winner.name}获胜，因为他有最少的牌(${minTiles}张)!`);
            gameState.gameStarted = false;
            startGameBtn.disabled = false;
            drawTileBtn.disabled = true;
            endTurnBtn.disabled = true;
            return true;
        }
    }

    return false;
}

// 更新游戏界面
function updateUI() {
    // 更新玩家牌架
    updatePlayerRack();

    // 更新AI玩家牌架
    updateAIRacks();

    // 更新游戏板 - 普通模式
    updateBoard(false);

    // 更新按钮状态
    updateButtons();
}

// 更新按钮状态
function updateButtons() {
    // 如果游戏板上有无效组合，禁用结束回合按钮
    if (gameState.board.length > 0 && !validateBoard()) {
        endTurnBtn.disabled = true;
        endTurnBtn.title = "游戏板上有无效组合";
    } else {
        endTurnBtn.disabled = false;
        endTurnBtn.title = "";
    }
}

// 更新玩家牌架
function updatePlayerRack() {
    playerRackEl.innerHTML = '';

    // 首先按照花色分组玩家的牌
    const colorGroups = {};
    // 小丑牌单独处理
    const jokers = [];

    gameState.players[0].rack.forEach((tile, index) => {
        if (tile.color === 'joker') {
            jokers.push({ tile, index });
        } else {
            if (!colorGroups[tile.color]) {
                colorGroups[tile.color] = [];
            }
            colorGroups[tile.color].push({ tile, index });
        }
    });

    // 为每种花色创建一行
    const colors = ['red', 'blue', 'yellow', 'black'];
    colors.forEach(color => {
        if (colorGroups[color] && colorGroups[color].length > 0) {
            // 创建花色行容器
            const colorRow = document.createElement('div');
            colorRow.classList.add('color-row');
            colorRow.dataset.color = color;

            // 将该花色的牌添加到行中
            colorGroups[color].forEach(item => {
                const tileEl = createTileElement(item.tile);

                // 添加拖拽功能
                tileEl.draggable = true;
                tileEl.dataset.source = 'rack';
                tileEl.dataset.index = item.index;

                // 拖拽事件
                tileEl.addEventListener('dragstart', handleDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);

                // 添加到颜色行
                colorRow.appendChild(tileEl);
            });

            // 将行添加到牌架
            playerRackEl.appendChild(colorRow);
        }
    });

    // 添加小丑牌行（如果有的话）
    if (jokers.length > 0) {
        const jokerRow = document.createElement('div');
        jokerRow.classList.add('color-row');
        jokerRow.dataset.color = 'joker';

        jokers.forEach(item => {
            const tileEl = createTileElement(item.tile);

            // 添加拖拽功能
            tileEl.draggable = true;
            tileEl.dataset.source = 'rack';
            tileEl.dataset.index = item.index;

            // 拖拽事件
            tileEl.addEventListener('dragstart', handleDragStart);
            tileEl.addEventListener('dragend', handleDragEnd);

            // 添加到小丑行
            jokerRow.appendChild(tileEl);
        });

        // 将小丑行添加到牌架
        playerRackEl.appendChild(jokerRow);
    }

    // 添加放置区域
    playerRackEl.addEventListener('dragover', handleDragOver);
    playerRackEl.addEventListener('drop', handleDrop);
}

// 更新AI玩家牌架
function updateAIRacks() {
    for (let i = 0; i < 3; i++) {
        const aiRackEl = aiRacks[i];
        aiRackEl.innerHTML = '';

        // 按花色分组AI玩家的牌
        const colorGroups = {};
        const jokers = [];

        // 显示AI玩家的真实牌面，按花色分组
        gameState.players[i + 1].rack.forEach(tile => {
            if (tile.color === 'joker') {
                jokers.push(tile);
            } else {
                if (!colorGroups[tile.color]) {
                    colorGroups[tile.color] = [];
                }
                colorGroups[tile.color].push(tile);
            }
        });

        // 为每种花色创建一行/列
        const colors = ['red', 'blue', 'yellow', 'black'];

        // 左右两侧的AI玩家使用列布局（垂直排列），上方AI使用行布局（水平排列）
        if (i === 0 || i === 2) { // AI1或AI3（左右两侧）
            // 确保排序顺序一致
            const colorOrder = { red: 0, blue: 1, yellow: 2, black: 3 };

            // 创建一个数组来保存有序的颜色组
            const orderedColorRows = Array(4).fill(null);

            // 为每种花色创建一列
            colors.forEach(color => {
                if (colorGroups[color] && colorGroups[color].length > 0) {
                    // 创建花色列容器
                    const colorRow = document.createElement('div');
                    colorRow.classList.add('color-row');
                    colorRow.dataset.color = color;

                    // 对花色组内的牌按数字排序
                    colorGroups[color].sort((a, b) => a.number - b.number);

                    // 将该花色的牌添加到列中
                    colorGroups[color].forEach(tile => {
                        const tileEl = createTileElement(tile);
                        // 添加AI玩家标识，用于样式区分
                        tileEl.classList.add('ai-tile');
                        colorRow.appendChild(tileEl);
                    });

                    // 将列保存到有序数组中的正确位置
                    orderedColorRows[colorOrder[color]] = colorRow;
                }
            });

            // 添加已创建的颜色列到牌架（按顺序）
            orderedColorRows.forEach(colorRow => {
                if (colorRow) {
                    aiRackEl.appendChild(colorRow);
                }
            });

            // 添加小丑牌列（如果有的话）
            if (jokers.length > 0) {
                const jokerRow = document.createElement('div');
                jokerRow.classList.add('color-row');
                jokerRow.dataset.color = 'joker';

                jokers.forEach(tile => {
                    const tileEl = createTileElement(tile);
                    // 添加AI玩家标识
                    tileEl.classList.add('ai-tile');
                    jokerRow.appendChild(tileEl);
                });

                // 将小丑列添加到牌架
                aiRackEl.appendChild(jokerRow);
            }
        } else { // AI2（上方）
            // 为每种花色创建一行
            colors.forEach(color => {
                if (colorGroups[color] && colorGroups[color].length > 0) {
                    // 创建花色行容器
                    const colorRow = document.createElement('div');
                    colorRow.classList.add('color-row');
                    colorRow.dataset.color = color;

                    // 将该花色的牌添加到行中
                    colorGroups[color].forEach(tile => {
                        const tileEl = createTileElement(tile);
                        // 添加AI玩家标识，用于样式区分
                        tileEl.classList.add('ai-tile');
                        colorRow.appendChild(tileEl);
                    });

                    // 将行添加到牌架
                    aiRackEl.appendChild(colorRow);
                }
            });

            // 添加小丑牌行（如果有的话）
            if (jokers.length > 0) {
                const jokerRow = document.createElement('div');
                jokerRow.classList.add('color-row');
                jokerRow.dataset.color = 'joker';

                jokers.forEach(tile => {
                    const tileEl = createTileElement(tile);
                    // 添加AI玩家标识
                    tileEl.classList.add('ai-tile');
                    jokerRow.appendChild(tileEl);
                });

                // 将小丑行添加到牌架
                aiRackEl.appendChild(jokerRow);
            }
        }
    }
}

// 更新游戏板
function updateBoard(isIntervention = false) {
    // 首先对所有组合进行排序
    sortAllGroups();

    boardEl.innerHTML = '';

    if (gameState.board.length === 0) {
        // 添加拖放区域指示
        const dropZone = document.createElement('div');
        dropZone.classList.add('drop-zone');
        dropZone.textContent = '拖放牌到这里形成组合';

        // 根据模式添加不同的拖放事件
        if (isIntervention) {
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('drop', handleInterventionDrop);
        } else {
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('drop', handleDrop);
        }

        dropZone.dataset.groupIndex = 'new';
        boardEl.appendChild(dropZone);
        return;
    }

    // 显示游戏板上的所有组合
    gameState.board.forEach((group, groupIndex) => {
        const groupEl = document.createElement('div');
        groupEl.classList.add('tile-group');
        groupEl.dataset.groupIndex = groupIndex;

        // 为每个组添加拖放事件，区分干预模式
        if (isIntervention) {
            groupEl.addEventListener('dragover', handleDragOver);
            groupEl.addEventListener('drop', handleInterventionDrop);
        } else {
            groupEl.addEventListener('dragover', handleDragOver);
            groupEl.addEventListener('drop', handleDrop);
        }

        // 检查这个组是否是有效组合
        const isValid = isValidCombination(group);
        if (isValid) {
            groupEl.classList.add('valid-group');
        } else {
            groupEl.classList.add('invalid-group');
        }

        group.forEach((tile, tileIndex) => {
            const tileEl = createTileElement(tile);

            // 添加拖拽功能
            tileEl.draggable = true;
            tileEl.dataset.source = 'board';
            tileEl.dataset.groupIndex = groupIndex;
            tileEl.dataset.tileIndex = tileIndex;

            // 拖拽事件，区分干预模式
            if (isIntervention) {
                tileEl.addEventListener('dragstart', handleInterventionDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);
            } else {
                tileEl.addEventListener('dragstart', handleDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);
            }

            groupEl.appendChild(tileEl);
        });

        boardEl.appendChild(groupEl);
    });

    // 添加新组放置区域
    const newGroupDropZone = document.createElement('div');
    newGroupDropZone.classList.add('drop-zone', 'new-group');
    newGroupDropZone.textContent = '+';
    newGroupDropZone.title = '拖放牌到这里形成新组合';

    // 区分干预模式
    if (isIntervention) {
        newGroupDropZone.addEventListener('dragover', handleDragOver);
        newGroupDropZone.addEventListener('drop', handleInterventionDrop);
    } else {
        newGroupDropZone.addEventListener('dragover', handleDragOver);
        newGroupDropZone.addEventListener('drop', handleDrop);
    }

    newGroupDropZone.dataset.groupIndex = 'new';
    boardEl.appendChild(newGroupDropZone);
}

// 对游戏板上的所有组合进行排序
function sortAllGroups() {
    for (let i = 0; i < gameState.board.length; i++) {
        if (gameState.board[i].length > 1) {
            sortGroup(gameState.board[i]);
        }
    }
}

// 创建瓷砖元素
function createTileElement(tile) {
    const tileEl = document.createElement('div');
    tileEl.classList.add('tile');
    tileEl.dataset.id = tile.id;

    if (tile.color === 'joker') {
        tileEl.classList.add('joker');
        tileEl.textContent = 'J';
    } else {
        tileEl.classList.add(`tile-${tile.color}`);
        tileEl.textContent = tile.number;
    }

    return tileEl;
}

// 拖拽开始处理
function handleDragStart(event) {
    if (!gameState.gameStarted || gameState.currentPlayer !== 0) {
        event.preventDefault();
        return;
    }

    // 如果是首次修改棋盘，保存原始状态
    if (!gameState.boardModified && gameState.board.length > 0) {
        saveOriginalBoard();
        gameState.boardModified = true;
    }

    const tileEl = event.target;

    // 设置拖拽数据
    event.dataTransfer.setData('text/plain', tileEl.dataset.id);
    event.dataTransfer.effectAllowed = 'move';

    // 记录拖拽源信息
    gameState.dragSourceType = tileEl.dataset.source;

    if (tileEl.dataset.source === 'rack') {
        const tileIndex = parseInt(tileEl.dataset.index);
        gameState.draggedTile = gameState.players[0].rack[tileIndex];
        gameState.dragSourceIndex = tileIndex;
    } else if (tileEl.dataset.source === 'board') {
        const groupIndex = parseInt(tileEl.dataset.groupIndex);
        const tileIndex = parseInt(tileEl.dataset.tileIndex);
        gameState.draggedTile = gameState.board[groupIndex][tileIndex];
        gameState.dragSourceIndex = groupIndex;
    }

    // 添加拖拽样式
    tileEl.classList.add('dragging');
}

// 拖拽结束处理
function handleDragEnd(event) {
    event.target.classList.remove('dragging');

    // 清除拖拽状态
    gameState.draggedTile = null;
    gameState.dragSourceType = null;
    gameState.dragSourceIndex = -1;

    // 如果是干预模式，重新显示干预面板
    if (gameState.humanInterventionMode) {
        const interventionPanel = document.getElementById('intervention-panel');
        if (interventionPanel) {
            interventionPanel.classList.remove('hidden');
        }
    }
}

// 拖拽经过处理
function handleDragOver(event) {
    event.preventDefault();

    // 标记有效放置区
    if (event.target.classList.contains('tile-group') ||
        event.target.classList.contains('drop-zone') ||
        event.target.classList.contains('rack')) {
        event.dataTransfer.dropEffect = 'move';
        event.target.classList.add('drag-over');
    }
}

// 放置处理
function handleDrop(event) {
    event.preventDefault();

    // 移除拖拽样式
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    if (!gameState.draggedTile) return;

    // 获取拖拽的牌ID
    const tileId = event.dataTransfer.getData('text/plain');

    // 找到目标放置位置
    let targetEl = event.target;
    let targetType;
    let targetGroupIndex;

    if (targetEl.classList.contains('tile')) {
        targetType = targetEl.dataset.source;
        targetGroupIndex = targetEl.dataset.groupIndex ? parseInt(targetEl.dataset.groupIndex) : -1;
    } else if (targetEl.classList.contains('tile-group')) {
        targetType = 'board';
        targetGroupIndex = parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.classList.contains('drop-zone')) {
        targetType = 'board';
        targetGroupIndex = targetEl.dataset.groupIndex === 'new' ? -1 : parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.classList.contains('rack')) {
        targetType = 'rack';
    } else {
        return; // 无效放置位置
    }

    // 处理放置逻辑
    if (gameState.dragSourceType === 'rack' && targetType === 'board') {
        // 从牌架移动到游戏板
        const tile = gameState.draggedTile;

        if (targetGroupIndex === -1 || targetEl.dataset.groupIndex === 'new') {
            // 创建新组
            gameState.board.push([tile]);
            // 新组也需要排序，尤其是当这个组将来会添加更多牌时
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            // 添加到现有组
            gameState.board[targetGroupIndex].push(tile);
            // 排序牌组
            sortGroup(gameState.board[targetGroupIndex]);
        }

        // 从玩家牌架中移除
        gameState.players[0].rack.splice(gameState.dragSourceIndex, 1);
    } else if (gameState.dragSourceType === 'board' && targetType === 'board') {
        // 从游戏板移动到游戏板
        const sourceGroupIndex = gameState.dragSourceIndex;
        const sourceTileIndex = gameState.board[sourceGroupIndex].findIndex(t => t.id === tileId);

        if (sourceGroupIndex === targetGroupIndex) {
            // 同组内重排序（暂不实现）
            return;
        }

        // 取出牌
        const tile = gameState.board[sourceGroupIndex][sourceTileIndex];
        gameState.board[sourceGroupIndex].splice(sourceTileIndex, 1);

        // 如果源组为空，移除
        if (gameState.board[sourceGroupIndex].length === 0) {
            gameState.board.splice(sourceGroupIndex, 1);
            // 更新大于sourceGroupIndex的目标索引
            if (targetGroupIndex > sourceGroupIndex) {
                targetGroupIndex--;
            }
        } else {
            // 如果源组不为空，重新排序源组
            sortGroup(gameState.board[sourceGroupIndex]);
        }

        if (targetGroupIndex === -1 || targetEl.dataset.groupIndex === 'new') {
            // 创建新组
            gameState.board.push([tile]);
            // 新组也需要排序
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            // 添加到目标组
            gameState.board[targetGroupIndex].push(tile);
            // 排序牌组
            sortGroup(gameState.board[targetGroupIndex]);
        }
    } else if (gameState.dragSourceType === 'board' && targetType === 'rack') {
        // 从游戏板移动回牌架
        const sourceGroupIndex = gameState.dragSourceIndex;
        const sourceTileIndex = gameState.board[sourceGroupIndex].findIndex(t => t.id === tileId);

        // 取出牌
        const tile = gameState.board[sourceGroupIndex][sourceTileIndex];
        gameState.board[sourceGroupIndex].splice(sourceTileIndex, 1);

        // 如果源组为空，移除
        if (gameState.board[sourceGroupIndex].length === 0) {
            gameState.board.splice(sourceGroupIndex, 1);
        } else {
            // 如果源组不为空，重新排序源组
            sortGroup(gameState.board[sourceGroupIndex]);
        }

        // 添加到玩家牌架
        gameState.players[0].rack.push(tile);
        sortPlayerRack(gameState.players[0]);
    }

    // 更新UI
    updateUI();
}

// 排序牌组 - 根据牌组类型自动排序
function sortGroup(group) {
    if (group.length < 2) return;

    // 检查是否是顺子
    const nonJokers = group.filter(tile => tile.color !== 'joker');
    if (nonJokers.length > 0) {
        const sameColor = nonJokers.every(tile => tile.color === nonJokers[0].color);
        if (sameColor) {
            // 是顺子，按数字排序
            // 1. 非百搭牌按数字排序
            nonJokers.sort((a, b) => a.number - b.number);

            // 2. 找出百搭牌
            const jokers = group.filter(tile => tile.color === 'joker');
            if (jokers.length === 0) {
                // 没有百搭牌，直接按数字排序返回
                group.sort((a, b) => a.number - b.number);
                return;
            }

            // 3. 分析非百搭牌的数字，找出连续序列中缺失的数字
            const numbers = nonJokers.map(tile => tile.number);
            const gaps = [];

            // 找出序列中的缺口
            for (let i = 0; i < numbers.length - 1; i++) {
                const current = numbers[i];
                const next = numbers[i + 1];
                const gap = next - current - 1;
                if (gap > 0) {
                    // 添加缺口信息：[缺口起始位置, 缺口大小]
                    gaps.push({
                        start: current,
                        size: gap
                    });
                }
            }

            // 4. 确定百搭牌应该放置的位置
            const result = [...nonJokers]; // 开始构建结果数组
            let remainingJokers = [...jokers];

            // 优先填补缺口
            if (gaps.length > 0) {
                // 按缺口大小升序排序，优先填补小缺口
                gaps.sort((a, b) => a.size - b.size);

                for (const gap of gaps) {
                    // 尝试填补当前缺口
                    for (let num = gap.start + 1; num < gap.start + 1 + gap.size; num++) {
                        if (remainingJokers.length > 0) {
                            // 确定插入位置
                            const insertIndex = result.findIndex(tile => tile.number > num);
                            const joker = remainingJokers.shift();

                            // 临时将百搭牌的数字设为缺口位置的数字（仅用于排序）
                            joker._displayNumber = num;

                            if (insertIndex === -1) {
                                // 插入到末尾
                                result.push(joker);
                            } else {
                                // 插入到指定位置
                                result.splice(insertIndex, 0, joker);
                            }
                        } else {
                            // 百搭牌用完了
                            break;
                        }
                    }

                    if (remainingJokers.length === 0) {
                        break;
                    }
                }
            }

            // 5. 处理剩余的百搭牌
            if (remainingJokers.length > 0) {
                // 计算序列的最小和最大值
                const min = numbers.length > 0 ? Math.min(...numbers) : 1;
                const max = numbers.length > 0 ? Math.max(...numbers) : 13;

                // 先尝试向下扩展
                let canExtendDown = min > 1;
                let downValue = min - 1;

                // 再尝试向上扩展
                let canExtendUp = max < MAX_NUMBER;
                let upValue = max + 1;

                // 交替扩展序列
                while (remainingJokers.length > 0 && (canExtendDown || canExtendUp)) {
                    if (canExtendDown) {
                        const joker = remainingJokers.shift();
                        joker._displayNumber = downValue;
                        result.unshift(joker); // 添加到开头
                        downValue--;
                        canExtendDown = downValue >= 1;
                    }

                    if (remainingJokers.length > 0 && canExtendUp) {
                        const joker = remainingJokers.shift();
                        joker._displayNumber = upValue;
                        result.push(joker); // 添加到末尾
                        upValue++;
                        canExtendUp = upValue <= MAX_NUMBER;
                    }
                }

                // 如果还有剩余百搭牌，全部放在末尾
                while (remainingJokers.length > 0) {
                    const joker = remainingJokers.shift();
                    joker._displayNumber = upValue++;
                    result.push(joker);
                }
            }

            // 6. 更新组
            for (let i = 0; i < result.length; i++) {
                group[i] = result[i];
            }

            // 7. 按显示数字排序
            group.sort((a, b) => {
                const aNum = a._displayNumber !== undefined ? a._displayNumber : a.number;
                const bNum = b._displayNumber !== undefined ? b._displayNumber : b.number;
                return aNum - bNum;
            });

            // 8. 清除临时属性
            group.forEach(tile => {
                if (tile._displayNumber !== undefined) {
                    delete tile._displayNumber;
                }
            });

            return;
        }
    }

    // 是同数字组，按颜色排序
    const colorOrder = { red: 1, blue: 2, yellow: 3, black: 4, joker: 0 }; // 修改：百搭牌放在最前面
    group.sort((a, b) => {
        return (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
    });
}

// 选择牌
function selectTile(index) {
    // 使用拖拽功能替代选择功能，此函数保留以兼容旧代码
    return;
}

// 获取牌的中文描述
function getTileDescription(tile) {
    if (tile.color === 'joker') {
        return "百搭牌";
    } else {
        // 翻译颜色为中文
        let colorName = "";
        switch (tile.color) {
            case 'red': colorName = "红"; break;
            case 'blue': colorName = "蓝"; break;
            case 'yellow': colorName = "黄"; break;
            case 'black': colorName = "黑"; break;
            default: colorName = tile.color;
        }
        return colorName + tile.number;
    }
}

// 获取详细的牌组信息
function getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, isPlayer = true) {
    let playerText = isPlayer ? "本回合" : "AI";
    let detailedLog = `${playerText}新放置了${newGroupCount}个牌组，总点数：${totalPoints}`;

    // 添加具体牌组信息
    if (newGroupCount > 0) {
        detailedLog += "\n牌组详情：";

        // 创建一个独立的方法来计算和显示牌组点数
        function appendGroupPoints(group) {
            let groupPoints = 0;
            group.forEach(tile => {
                if (tile.color === 'joker') {
                    groupPoints += 30; // 百搭牌算30分
                } else {
                    groupPoints += tile.number;
                }
            });
            return ` [${groupPoints}点]`;
        }

        if (originalGroups.length === 0) {
            // 所有当前牌组都是新放置的
            gameState.board.forEach((group, groupIndex) => {
                detailedLog += "\n- 牌组" + (groupIndex + 1) + ": ";
                group.forEach(tile => {
                    detailedLog += getTileDescription(tile) + " ";
                });
                detailedLog += appendGroupPoints(group);
            });
        } else {
            // 跟踪新牌组编号
            let newGroupNumber = 1;

            // 新增的牌组
            for (let i = originalGroups.length; i < gameState.board.length; i++) {
                detailedLog += "\n- 牌组" + newGroupNumber + ": ";
                gameState.board[i].forEach(tile => {
                    detailedLog += getTileDescription(tile) + " ";
                });
                detailedLog += appendGroupPoints(gameState.board[i]);
                newGroupNumber++;
            }

            // 检查已有牌组中新添加的牌
            for (let i = 0; i < originalGroups.length; i++) {
                const originalGroup = originalGroups[i];
                const currentGroup = gameState.board[i];

                // 检查该组是否有新增的牌
                if (currentGroup.length > originalGroup.length) {
                    // 找出新增的牌
                    const originalIds = new Set(originalGroup.map(tile => tile.id));
                    const newTiles = currentGroup.filter(tile => !originalIds.has(tile.id));

                    if (newTiles.length > 0) {
                        detailedLog += "\n- 向现有牌组添加: ";
                        newTiles.forEach(tile => {
                            detailedLog += getTileDescription(tile) + " ";
                        });
                        // 计算添加的牌的点数
                        let addedPoints = 0;
                        newTiles.forEach(tile => {
                            if (tile.color === 'joker') {
                                addedPoints += 30;
                            } else {
                                addedPoints += tile.number;
                            }
                        });
                        detailedLog += ` [${addedPoints}点]`;
                    }
                }
            }
        }
    }

    return detailedLog;
}

// 记录消息
function logMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 页面加载时初始化游戏
document.addEventListener('DOMContentLoaded', initGame);

// 添加撤销按钮功能
const undoBtn = document.getElementById('undo-btn');
if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (gameState.boardModified && gameState.originalBoard) {
            restoreOriginalBoard();
            logMessage('已撤销本回合的修改');
        } else {
            logMessage('没有可撤销的操作');
        }
    });
}

// 询问人类玩家是否要替AI出牌
function confirmHumanIntervention(aiPlayer) {
    // 询问人类玩家是否要替AI出牌
    const confirmed = confirm(`${aiPlayer.name}没有找到可行的出牌方案。\n是否需要你来帮助它出牌？\n（点击"确定"将允许你操作${aiPlayer.name}的牌）`);

    if (confirmed) {
        // 保存棋盘原始状态，用于干预模式下计算点数
        if (gameState.board.length > 0 && !gameState.originalBoard) {
            saveOriginalBoard();
        }

        // 启用人类干预模式
        enableHumanIntervention(aiPlayer);
        return true;
    }

    return false;
}

// 启用人类干预模式，允许人类玩家代替AI出牌
function enableHumanIntervention(aiPlayer) {
    // 记录当前的AI玩家
    gameState.interventionAIPlayer = aiPlayer;
    gameState.humanInterventionMode = true;

    // 更新UI，显示AI玩家的牌和相关控制按钮
    updateInterventionUI();

    // 显示提示消息
    logMessage(`你正在帮助${aiPlayer.name}出牌。完成后请点击"完成干预"按钮。`);
}

// 更新人类干预模式的UI
function updateInterventionUI() {
    // 移除现有面板（如果存在）
    const existingPanel = document.getElementById('intervention-panel');
    if (existingPanel) {
        existingPanel.remove();
    }

    // 创建干预模式的浮动面板
    const interventionPanel = document.createElement('div');
    interventionPanel.id = 'intervention-panel';
    interventionPanel.classList.add('intervention-panel');

    // 创建标题
    const title = document.createElement('h3');
    title.textContent = `帮助${gameState.interventionAIPlayer.name}出牌`;
    interventionPanel.appendChild(title);

    // 创建提示文本
    const hint = document.createElement('p');
    hint.textContent = '你可以拖动AI的牌到游戏板，也可以重新排列游戏板上的牌组。所有常规的拖拽操作都支持。';
    hint.classList.add('intervention-hint');
    interventionPanel.appendChild(hint);

    // 创建AI玩家牌架容器
    const aiRackContainer = document.createElement('div');
    aiRackContainer.classList.add('ai-rack-container');

    // 显示AI玩家的牌
    const aiRack = document.createElement('div');
    aiRack.classList.add('intervention-rack');

    // 将AI玩家的牌按花色分组
    const colorGroups = {};
    const jokers = [];

    gameState.interventionAIPlayer.rack.forEach((tile, index) => {
        if (tile.color === 'joker') {
            jokers.push({ tile, index });
        } else {
            if (!colorGroups[tile.color]) {
                colorGroups[tile.color] = [];
            }
            colorGroups[tile.color].push({ tile, index });
        }
    });

    // 为每种花色创建一行
    const colors = ['red', 'blue', 'yellow', 'black'];
    colors.forEach(color => {
        if (colorGroups[color] && colorGroups[color].length > 0) {
            // 创建花色行容器
            const colorRow = document.createElement('div');
            colorRow.classList.add('color-row');
            colorRow.dataset.color = color;

            // 按数字排序该花色的牌
            colorGroups[color].sort((a, b) => a.tile.number - b.tile.number);

            // 将该花色的牌添加到行中
            colorGroups[color].forEach(item => {
                const tileEl = createTileElement(item.tile);

                // 添加拖拽功能
                tileEl.draggable = true;
                tileEl.dataset.source = 'intervention-rack';
                tileEl.dataset.index = item.index;

                // 拖拽事件
                tileEl.addEventListener('dragstart', handleInterventionDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);

                // 添加到颜色行
                colorRow.appendChild(tileEl);
            });

            // 将行添加到AI牌架
            aiRack.appendChild(colorRow);
        }
    });

    // 添加小丑牌行（如果有的话）
    if (jokers.length > 0) {
        const jokerRow = document.createElement('div');
        jokerRow.classList.add('color-row');
        jokerRow.dataset.color = 'joker';

        jokers.forEach(item => {
            const tileEl = createTileElement(item.tile);

            // 添加拖拽功能
            tileEl.draggable = true;
            tileEl.dataset.source = 'intervention-rack';
            tileEl.dataset.index = item.index;

            // 拖拽事件
            tileEl.addEventListener('dragstart', handleInterventionDragStart);
            tileEl.addEventListener('dragend', handleDragEnd);

            // 添加到小丑行
            jokerRow.appendChild(tileEl);
        });

        // 将小丑行添加到AI牌架
        aiRack.appendChild(jokerRow);
    }

    // 添加放置区域事件
    aiRack.addEventListener('dragover', handleDragOver);
    aiRack.addEventListener('drop', handleInterventionDrop);

    aiRackContainer.appendChild(aiRack);
    interventionPanel.appendChild(aiRackContainer);

    // 创建控制按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('intervention-buttons');

    // 创建完成干预按钮
    const finishButton = document.createElement('button');
    finishButton.id = 'finish-intervention-btn';
    finishButton.textContent = '完成干预';
    finishButton.addEventListener('click', finishHumanIntervention);

    // 创建取消干预按钮
    const cancelButton = document.createElement('button');
    cancelButton.id = 'cancel-intervention-btn';
    cancelButton.textContent = '取消干预';
    cancelButton.addEventListener('click', cancelHumanIntervention);

    buttonContainer.appendChild(finishButton);
    buttonContainer.appendChild(cancelButton);
    interventionPanel.appendChild(buttonContainer);

    // 添加到页面
    document.body.appendChild(interventionPanel);

    // 启用游戏板拖放功能
    enableBoardDragDrop();
}

// 启用游戏板拖放功能
function enableBoardDragDrop() {
    // 清除现有的游戏板，然后重新渲染以添加干预模式的事件监听器
    updateBoard(true);
}

// 处理人类干预模式下的拖拽开始
function handleInterventionDragStart(event) {
    const tileEl = event.target;

    // 设置拖拽数据
    event.dataTransfer.setData('text/plain', tileEl.dataset.id);
    event.dataTransfer.effectAllowed = 'move';

    // 记录拖拽源信息
    gameState.dragSourceType = tileEl.dataset.source;

    if (tileEl.dataset.source === 'intervention-rack') {
        const tileIndex = parseInt(tileEl.dataset.index);
        gameState.draggedTile = gameState.interventionAIPlayer.rack[tileIndex];
        gameState.dragSourceIndex = tileIndex;
    } else if (tileEl.dataset.source === 'board') {
        const groupIndex = parseInt(tileEl.dataset.groupIndex);
        const tileIndex = parseInt(tileEl.dataset.tileIndex);
        gameState.draggedTile = gameState.board[groupIndex][tileIndex];
        gameState.dragSourceIndex = groupIndex;
        gameState.draggedTileIndex = tileIndex;
    }

    // 添加拖拽样式
    tileEl.classList.add('dragging');

    // 临时隐藏AI干预面板
    const interventionPanel = document.getElementById('intervention-panel');
    if (interventionPanel) {
        interventionPanel.classList.add('hidden');
    }
}

// 处理人类干预模式下的放置
function handleInterventionDrop(event) {
    event.preventDefault();

    // 移除拖拽样式
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    if (!gameState.draggedTile) return;

    // 获取拖拽的牌ID
    const tileId = event.dataTransfer.getData('text/plain');

    // 找到目标放置位置
    let targetEl = event.target;
    let targetType;
    let targetGroupIndex;

    if (targetEl.classList.contains('tile')) {
        targetType = targetEl.dataset.source === 'intervention-rack' ? 'intervention-rack' : 'board';
        targetGroupIndex = targetEl.dataset.groupIndex ? parseInt(targetEl.dataset.groupIndex) : -1;
    } else if (targetEl.classList.contains('tile-group')) {
        targetType = 'board';
        targetGroupIndex = parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.classList.contains('drop-zone')) {
        targetType = 'board';
        targetGroupIndex = targetEl.dataset.groupIndex === 'new' ? -1 : parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.classList.contains('intervention-rack') || targetEl.classList.contains('color-row')) {
        targetType = 'intervention-rack';
    } else {
        return; // 无效放置位置
    }

    // 处理放置逻辑
    if (gameState.dragSourceType === 'intervention-rack' && targetType === 'board') {
        // 从AI牌架移动到游戏板
        const tile = gameState.draggedTile;

        if (targetGroupIndex === -1 || targetEl.dataset.groupIndex === 'new') {
            // 创建新组
            gameState.board.push([tile]);
            // 新组也需要排序
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            // 添加到现有组
            gameState.board[targetGroupIndex].push(tile);
            // 排序牌组
            sortGroup(gameState.board[targetGroupIndex]);
        }

        // 从AI牌架中移除
        gameState.interventionAIPlayer.rack.splice(gameState.dragSourceIndex, 1);
    } else if (gameState.dragSourceType === 'board' && targetType === 'intervention-rack') {
        // 从游戏板移动回AI牌架
        const sourceGroupIndex = gameState.dragSourceIndex;
        const sourceTileIndex = gameState.draggedTileIndex;

        if (sourceTileIndex === undefined || sourceGroupIndex === undefined) {
            console.warn('源牌位置信息缺失');
            return;
        }

        // 取出牌
        const tile = gameState.board[sourceGroupIndex][sourceTileIndex];
        gameState.board[sourceGroupIndex].splice(sourceTileIndex, 1);

        // 如果源组为空，移除
        if (gameState.board[sourceGroupIndex].length === 0) {
            gameState.board.splice(sourceGroupIndex, 1);
        } else {
            // 如果源组不为空，重新排序源组
            sortGroup(gameState.board[sourceGroupIndex]);
        }

        // 添加到AI牌架
        gameState.interventionAIPlayer.rack.push(tile);
        sortPlayerRack(gameState.interventionAIPlayer);
    } else if (gameState.dragSourceType === 'board' && targetType === 'board') {
        // 从游戏板移动到游戏板
        const sourceGroupIndex = gameState.dragSourceIndex;
        const sourceTileIndex = gameState.draggedTileIndex;

        if (sourceTileIndex === undefined || sourceGroupIndex === undefined) {
            console.warn('源牌位置信息缺失');
            return;
        }

        if (sourceGroupIndex === targetGroupIndex) {
            // 同组内重排序（暂不实现）
            return;
        }

        // 取出牌
        const tile = gameState.board[sourceGroupIndex][sourceTileIndex];
        gameState.board[sourceGroupIndex].splice(sourceTileIndex, 1);

        // 如果源组为空，移除
        if (gameState.board[sourceGroupIndex].length === 0) {
            gameState.board.splice(sourceGroupIndex, 1);
            // 更新大于sourceGroupIndex的目标索引
            if (targetGroupIndex > sourceGroupIndex) {
                targetGroupIndex--;
            }
        } else {
            // 如果源组不为空，重新排序源组
            sortGroup(gameState.board[sourceGroupIndex]);
        }

        if (targetGroupIndex === -1 || targetEl.dataset.groupIndex === 'new') {
            // 创建新组
            gameState.board.push([tile]);
            // 新组也需要排序
            sortGroup(gameState.board[gameState.board.length - 1]);
        } else {
            // 添加到目标组
            gameState.board[targetGroupIndex].push(tile);
            // 排序牌组
            sortGroup(gameState.board[targetGroupIndex]);
        }
    }

    // 更新界面 - 使用干预模式更新
    updateBoard(true);
    updateInterventionUI();
}

// 完成人类干预
function finishHumanIntervention() {
    // 检查游戏板是否有效
    if (!validateBoard()) {
        alert('游戏板上有无效的组合，请调整后再完成干预');
        return;
    }

    // 如果是首次出牌，检查总点数是否足够
    const aiPlayer = gameState.interventionAIPlayer;

    // 获取原始棋盘状态（干预开始时的状态）
    const originalGroups = gameState.originalBoard || [];

    // 计算当前回合AI放置的牌的总点数
    let totalPoints = 0;
    let newGroupCount = 0;

    if (originalGroups.length === 0) {
        // 如果原来棋盘为空，所有当前牌组都是新放置的
        gameState.board.forEach(group => {
            group.forEach(tile => {
                if (tile.color === 'joker') {
                    totalPoints += 30; // 百搭牌算30分
                } else {
                    totalPoints += tile.number;
                }
            });
            newGroupCount++;
        });
    } else {
        // 比较原始棋盘和当前棋盘，计算新增牌的点数
        // 先检查新增的牌组
        for (let i = 0; i < gameState.board.length; i++) {
            // 检查这个组是否是新增的（原始棋盘中不存在）
            let isNewGroup = i >= originalGroups.length;

            if (isNewGroup) {
                // 新增的整组
                gameState.board[i].forEach(tile => {
                    if (tile.color === 'joker') {
                        totalPoints += 30; // 百搭牌算30分
                    } else {
                        totalPoints += tile.number;
                    }
                });
                newGroupCount++;
            } else {
                // 比较原有组中是否添加了新牌
                const originalGroup = originalGroups[i];
                const currentGroup = gameState.board[i];

                // 检查该组是否有新增的牌
                if (currentGroup.length > originalGroup.length) {
                    // 找出新增的牌
                    const originalIds = new Set(originalGroup.map(tile => tile.id));
                    const newTiles = currentGroup.filter(tile => !originalIds.has(tile.id));

                    // 计算新增牌的点数
                    newTiles.forEach(tile => {
                        if (tile.color === 'joker') {
                            totalPoints += 30; // 百搭牌算30分
                        } else {
                            totalPoints += tile.number;
                        }
                    });
                }
            }
        }
    }

    // 使用辅助函数生成并输出详细信息
    const detailedLog = getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, false).replace('AI', aiPlayer.name);

    if (aiPlayer.firstMove) {
        if (totalPoints < MIN_FIRST_MOVE_POINTS) {
            alert(`首次出牌总点数需要至少${MIN_FIRST_MOVE_POINTS}点，当前只有${totalPoints}点`);
            return;
        }

        // 更新首次出牌状态
        aiPlayer.firstMove = false;
        logMessage(detailedLog);
        logMessage(`你已帮助${aiPlayer.name}完成首次出牌，总点数：${totalPoints}`);
    } else if (newGroupCount > 0 || totalPoints > 0) {
        // 非首次出牌但有操作时，记录详细日志
        logMessage(detailedLog);
    }

    // 移除干预面板
    const panel = document.getElementById('intervention-panel');
    if (panel) {
        panel.remove();
    }

    // 重置干预状态
    gameState.humanInterventionMode = false;
    gameState.interventionAIPlayer = null;

    // 清除原始棋盘状态
    gameState.originalBoard = null;

    // 更新当前玩家
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    // 更新界面
    updateUI();

    // 检查游戏是否结束
    if (checkGameEnd()) {
        return;
    }

    // 继续游戏
    setTimeout(() => aiTurn(), 300);

    logMessage('你已成功帮助AI完成出牌！');
}

// 取消人类干预
function cancelHumanIntervention() {
    // 移除干预面板
    const panel = document.getElementById('intervention-panel');
    if (panel) {
        panel.remove();
    }

    // 恢复原始状态
    if (gameState.originalBoard) {
        gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
        // 清除原始棋盘状态
        gameState.originalBoard = null;
    }

    // 重置干预状态
    gameState.humanInterventionMode = false;
    const aiPlayer = gameState.interventionAIPlayer;
    gameState.interventionAIPlayer = null;

    // AI无法出牌，抽一张牌
    if (gameState.deck.length > 0) {
        drawTileForPlayer(aiPlayer);
        sortPlayerRack(aiPlayer);

        // 记录抽到的牌是什么
        const lastDrawnTile = aiPlayer.rack[aiPlayer.rack.length - 1];
        const tileDescription = lastDrawnTile ? `（${getTileDescription(lastDrawnTile)}）` : '';
        logMessage(`${aiPlayer.name}抽了一张牌${tileDescription}`);
    } else {
        logMessage(`牌组已空，${aiPlayer.name}无法抽牌`);
    }

    // 更新当前玩家
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    // 更新界面
    updateUI();

    // 检查游戏是否结束
    if (checkGameEnd()) {
        return;
    }

    // 继续游戏
    setTimeout(() => aiTurn(), 300);

    logMessage('你已取消对AI的干预，AI已抽牌。');
} 