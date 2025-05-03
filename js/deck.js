// 牌组管理模块
import { COLORS, MAX_NUMBER, JOKER_COUNT } from './config.js';
import { gameState } from './gameState.js';

// 初始化牌组
export function initDeck() {
    gameState.deck = [];

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
}

// 洗牌
export function shuffleDeck() {
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
}

// 为指定玩家抽牌
export function drawTileForPlayer(player) {
    if (gameState.deck.length > 0) {
        const tile = gameState.deck.pop();
        player.rack.push(tile);
        return tile;
    }
    return null;
}

// 获取牌的描述
export function getTileDescription(tile) {
    if (tile.color === 'joker') {
        return '百搭';
    }

    const colorNames = {
        'red': '红',
        'blue': '蓝',
        'yellow': '黄',
        'black': '黑'
    };

    return `${colorNames[tile.color] || tile.color}${tile.number}`;
} 