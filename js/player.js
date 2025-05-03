// 玩家相关逻辑模块
import { gameState, restoreOriginalBoard } from './gameState.js';
import { validateBoard, checkGameEnd, MIN_FIRST_MOVE_POINTS } from './validation.js';
import { getTileDescription, drawTileForPlayer } from './deck.js';

// 抽牌
export function drawTile(updateUI, aiTurn, logMessage) {
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
            updateUI();
        } else {
            return;
        }
    }

    const currentPlayer = gameState.players[gameState.currentPlayer];
    const drawnTile = drawTileForPlayer(currentPlayer);
    sortPlayerRack(currentPlayer);

    // 重置棋盘修改状态
    gameState.boardModified = false;
    gameState.originalBoard = null;

    updateUI();

    // 记录抽到的牌是什么
    const tileDescription = drawnTile ? `（${getTileDescription(drawnTile)}）` : '';

    // 延迟执行回合结束逻辑，确保UI更新完成
    setTimeout(() => {
        logMessage(`你抽了一张牌${tileDescription}，回合结束`);

        // 更新当前玩家
        gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

        // 更新UI
        updateUI();

        // 检查游戏是否结束
        const gameEndResult = checkGameEnd();
        if (gameEndResult.gameOver) {
            logMessage(`游戏结束！${gameEndResult.winnerName}赢了！`);
            return;
        }

        // 进一步延时，确保UI完全更新后再执行AI回合
        setTimeout(() => {
            // AI玩家的回合
            aiTurn(logMessage, updateUI);
        }, 300);
    }, 500);
}

// 结束回合
export function endTurn(updateUI, aiTurn, logMessage) {
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

    // 首次出牌需要满足最低点数要求
    if (gameState.players[0].firstMove && gameState.boardModified) {
        // 计算本次出的牌的总点数
        let totalPoints = 0;
        gameState.board.forEach(group => {
            // 只计算当前玩家出的牌
            group.forEach(tile => {
                if (tile.fromPlayer === 0) {
                    totalPoints += tile.number || 30; // 百搭牌值30分
                }
            });
        });

        if (totalPoints < MIN_FIRST_MOVE_POINTS) {
            logMessage(`首次出牌总点数需达到${MIN_FIRST_MOVE_POINTS}分，当前只有${totalPoints}分`);
            return;
        }

        // 标记玩家已完成首次出牌
        gameState.players[0].firstMove = false;
        logMessage(`首次出牌成功，总点数${totalPoints}分`);
    }
    // 非首次出牌，只要棋盘有效就允许结束回合（计算并展示本次出的牌）
    else if (gameState.boardModified) {
        // 计算本次出的牌的总点数和数量
        let totalPoints = 0;
        let tileCount = 0;
        gameState.board.forEach(group => {
            // 只计算当前玩家出的牌
            group.forEach(tile => {
                if (tile.fromPlayer === 0) {
                    totalPoints += tile.number || 30; // 百搭牌值30分
                    tileCount++;
                }
            });
        });

        if (tileCount > 0) {
            logMessage(`你出了${tileCount}张牌，总点数${totalPoints}分`);
        } else {
            logMessage('你重新组织了棋盘上的牌');
        }
    }

    gameState.originalBoard = null;
    gameState.boardModified = false;

    // 下一位玩家
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;

    logMessage('回合结束，轮到AI玩家');
    updateUI();

    // 检查游戏是否结束
    const gameEndResult = checkGameEnd();
    if (gameEndResult.gameOver) {
        logMessage(`游戏结束！${gameEndResult.winnerName}赢了！`);
        return;
    }

    // AI玩家的回合
    setTimeout(() => {
        aiTurn(logMessage, updateUI);
    }, 500);
}

// 从牌架移除牌
export function removeTilesFromRack(player, tiles) {
    const tileIds = tiles.map(tile => tile.id);
    player.rack = player.rack.filter(tile => !tileIds.includes(tile.id));
}

// 按数字排序玩家的牌
export function sortPlayerRack(player) {
    player.rack.sort((a, b) => {
        // 百搭牌排最后
        if (a.color === 'joker') return 1;
        if (b.color === 'joker') return -1;

        // 先按颜色排序
        if (a.color !== b.color) {
            const colorOrder = { 'red': 0, 'blue': 1, 'yellow': 2, 'black': 3 };
            return colorOrder[a.color] - colorOrder[b.color];
        }

        // 再按数字排序
        return a.number - b.number;
    });
} 