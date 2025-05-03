// 游戏状态管理模块

// 游戏状态对象
export const gameState = {
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

// 保存棋盘状态
export function saveOriginalBoard() {
    // 深拷贝当前棋盘状态
    gameState.originalBoard = JSON.parse(JSON.stringify(gameState.board));
}

// 恢复棋盘状态
export function restoreOriginalBoard() {
    if (gameState.originalBoard) {
        gameState.board = JSON.parse(JSON.stringify(gameState.originalBoard));
        gameState.originalBoard = null;
        gameState.boardModified = false;
    }
}

// 添加到棋盘
export function addToBoard(tiles) {
    gameState.board.push([...tiles]);
} 