// 验证相关模块
import { MIN_FIRST_MOVE_POINTS } from './config.js';
import { gameState } from './gameState.js';

// 导出MIN_FIRST_MOVE_POINTS常量以便其他模块可以使用
export { MIN_FIRST_MOVE_POINTS };

// 检查组合是否有效
export function isValidCombination(tiles) {
    if (!tiles || tiles.length < 3) {
        return false;
    }

    // 组合必须是同数字组或顺子
    return isSameNumberGroup(tiles) || isRun(tiles);
}

// 判断是否为同数字组
export function isSameNumberGroup(tiles) {
    if (tiles.length < 3 || tiles.length > 4) {
        return false;
    }

    // 获取非百搭牌
    const nonJokers = tiles.filter(tile => tile.color !== 'joker');
    if (nonJokers.length === 0) {
        return false; // 不能全是百搭牌
    }

    // 检查所有非百搭牌是否有相同的数字
    const targetNumber = nonJokers[0].number;
    const hasSameNumber = nonJokers.every(tile => tile.number === targetNumber);
    if (!hasSameNumber) {
        return false;
    }

    // 检查颜色是否各不相同
    const colors = nonJokers.map(tile => tile.color);
    const uniqueColors = new Set(colors);
    return uniqueColors.size === nonJokers.length;
}

// 判断是否为顺子
export function isRun(tiles) {
    if (tiles.length < 3) {
        return false;
    }

    // 获取非百搭牌
    const nonJokers = tiles.filter(tile => tile.color !== 'joker');
    const jokerCount = tiles.length - nonJokers.length;

    if (nonJokers.length === 0) {
        return false; // 不能全是百搭牌
    }

    // 检查所有非百搭牌是否有相同的颜色
    const targetColor = nonJokers[0].color;
    const hasSameColor = nonJokers.every(tile => tile.color === targetColor);
    if (!hasSameColor) {
        return false;
    }

    // 按数字排序
    const sortedTiles = [...nonJokers].sort((a, b) => a.number - b.number);

    // 检查是否连续（考虑百搭牌可以填补空缺）
    let gaps = 0;
    for (let i = 1; i < sortedTiles.length; i++) {
        const gap = sortedTiles[i].number - sortedTiles[i - 1].number - 1;
        if (gap < 0) return false; // 数字重复
        gaps += gap;
    }

    // 百搭牌数量必须足够填补所有空缺
    return jokerCount >= gaps;
}

// 计算牌组点数
export function calculatePoints(tiles) {
    return tiles.reduce((sum, tile) => {
        // 百搭牌算30分
        if (tile.color === 'joker') return sum + 30;
        return sum + tile.number;
    }, 0);
}

// 验证整个棋盘
export function validateBoard() {
    // 验证每个组合是否合法
    return gameState.board.every(group => isValidCombination(group));
}

// 检查游戏是否结束
export function checkGameEnd() {
    for (let i = 0; i < gameState.players.length; i++) {
        if (gameState.players[i].rack.length === 0) {
            // 玩家i赢了
            const winnerName = gameState.players[i].isHuman ? '你' : gameState.players[i].name;
            return {
                gameOver: true,
                winner: i,
                winnerName
            };
        }
    }

    return {
        gameOver: false
    };
} 