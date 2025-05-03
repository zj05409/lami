// 主要游戏流程和初始化模块
import { gameState, saveOriginalBoard, restoreOriginalBoard, addToBoard } from './gameState.js';
import { initDeck, drawTileForPlayer, getTileDescription } from './deck.js';
import { validateBoard, checkGameEnd, isValidCombination } from './validation.js';
import {
    initUIElements,
    updateUI,
    logMessage,
    sortAllGroups,
    setDragDropHandlers,
    handleBoardDragStart
} from './ui.js';
import { drawTile, endTurn, removeTilesFromRack, sortPlayerRack } from './player.js';
import { aiTurn } from './ai.js';

// 在页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    // 初始化UI元素引用
    initUIElements();

    // 初始化事件监听
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('draw-tile').addEventListener('click', () => drawTile(updateUI, aiTurn, logMessage));
    document.getElementById('end-turn').addEventListener('click', () => endTurn(updateUI, aiTurn, logMessage));
    document.getElementById('undo-btn').addEventListener('click', undoMoves);

    // 添加一个隐藏的调试按钮，用于手动重置aiAnimating状态
    const debugBtn = document.createElement('button');
    debugBtn.textContent = "重置AI状态";
    debugBtn.style.display = 'none';
    debugBtn.id = 'debug-btn';
    debugBtn.addEventListener('click', () => {
        gameState.aiAnimating = false;
        console.log('手动重置aiAnimating=false');
        updateUI();
        logMessage('已重置AI动画状态');
    });
    document.querySelector('.controls').appendChild(debugBtn);

    // 添加键盘快捷键(按D键)显示调试按钮
    document.addEventListener('keydown', (e) => {
        if (e.key === 'd' && e.ctrlKey) {
            const debugBtn = document.getElementById('debug-btn');
            if (debugBtn) {
                debugBtn.style.display = debugBtn.style.display === 'none' ? 'inline-block' : 'none';
            }
        }
    });

    // 设置拖放处理函数
    setDragDropHandlers(handleDrop, handleInterventionDragStart, handleInterventionDrop);

    // 禁用初始时不需要的按钮
    document.getElementById('draw-tile').disabled = true;
    document.getElementById('end-turn').disabled = true;

    // 添加安全检查，确保aiAnimating状态不会被长时间卡住
    setInterval(monitorAIAnimatingState, 5000);

    logMessage('游戏已加载，请点击开始游戏按钮');
});

// 监视AI动画状态，如果状态卡住则重置
function monitorAIAnimatingState() {
    if (gameState.aiAnimating && gameState.players[gameState.currentPlayer].isHuman) {
        // AI动画状态为true，但当前玩家是人类，说明状态卡住了
        console.warn('检测到异常：AI动画状态卡住了，自动重置');
        gameState.aiAnimating = false;
        updateUI();
        logMessage('系统检测到异常状态并自动修复');
    }
}

// 撤销本回合的移动
function undoMoves() {
    if (!gameState.gameStarted) {
        logMessage('请先开始游戏');
        return;
    }

    if (gameState.currentPlayer !== 0) {
        logMessage('现在不是你的回合');
        return;
    }

    if (!gameState.boardModified) {
        logMessage('没有需要撤销的修改');
        return;
    }

    restoreOriginalBoard();
    updateUI();
    logMessage('已撤销本回合的所有修改');
}

// 初始化游戏
function initGame() {
    // 重置游戏状态
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

    // 初始化牌组
    initDeck();

    // 更新界面
    updateUI();

    logMessage('游戏已初始化，请点击开始游戏按钮');
}

// 开始游戏
function startGame() {
    if (gameState.gameStarted) {
        logMessage('游戏已经开始');
        return;
    }

    // 初始化游戏（确保所有状态被正确重置）
    initGame();

    // 标记游戏已开始
    gameState.gameStarted = true;

    // 确保AI动画状态被重置
    gameState.aiAnimating = false;

    // 发牌给所有玩家
    gameState.players.forEach(player => {
        for (let i = 0; i < 14; i++) {
            drawTileForPlayer(player);
        }
    });

    // 按数字排序玩家的牌
    gameState.players.forEach(player => {
        sortPlayerRack(player);
    });

    // 重置当前玩家为人类玩家
    gameState.currentPlayer = 0;

    // 更新UI
    updateUI();

    // 启用按钮
    document.getElementById('start-game').disabled = true;
    document.getElementById('draw-tile').disabled = false;
    document.getElementById('end-turn').disabled = false;

    // 记录游戏状态，确保一切正常
    console.log('游戏开始状态:', {
        gameStarted: gameState.gameStarted,
        currentPlayer: gameState.currentPlayer,
        aiAnimating: gameState.aiAnimating,
        deckLength: gameState.deck.length
    });

    logMessage('游戏开始! 轮到你出牌了');
}

// 处理拖放事件
function handleDrop(event) {
    event.preventDefault();

    if (!gameState.draggedTile) return;

    // 移除拖拽样式
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    // 获取拖拽的牌ID
    const tileId = event.dataTransfer.getData('text/plain');

    // 确定目标类型和位置
    let targetEl = event.target;
    let targetType = null;
    let targetGroupIndex = -1;

    // 检查是否拖到了牌架上或游戏板上
    if (targetEl.classList.contains('tile')) {
        // 落在了牌上，需要获取父元素
        const parentEl = targetEl.closest('.tile-group') || targetEl.closest('.rack');
        if (parentEl && parentEl.classList.contains('tile-group')) {
            targetType = 'board';
            targetGroupIndex = parseInt(parentEl.dataset.groupIndex);
        } else if (parentEl && parentEl.classList.contains('rack')) {
            targetType = 'rack';
        }
    } else if (targetEl.classList.contains('tile-group')) {
        // 落在了牌组上
        targetType = 'board';
        targetGroupIndex = parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.classList.contains('drop-zone')) {
        // 落在了空的牌组区域
        targetType = 'board';
        targetGroupIndex = targetEl.dataset.groupIndex === 'new' ? gameState.board.length : parseInt(targetEl.dataset.groupIndex);
    } else if (targetEl.id === 'player-rack' || targetEl.closest('#player-rack') || targetEl.classList.contains('color-row')) {
        // 落在了玩家牌架上
        targetType = 'rack';
    } else {
        return; // 不是有效的放置位置
    }

    // 如果是第一次修改棋盘，保存原始状态
    if (!gameState.boardModified) {
        saveOriginalBoard();
        gameState.boardModified = true;
    }

    // 处理拖拽逻辑
    if (gameState.dragSourceType === 'rack' && targetType === 'board') {
        // 从玩家牌架拖到游戏板
        const tile = { ...gameState.draggedTile, fromPlayer: 0 }; // 标记牌的来源是玩家

        if (targetGroupIndex >= gameState.board.length) {
            // 创建新组
            addToBoard([tile]);
        } else {
            // 添加到现有组
            gameState.board[targetGroupIndex].push(tile);
        }

        // 从玩家牌架移除该牌
        removeTilesFromRack(gameState.players[0], [gameState.draggedTile]);
    } else if (gameState.dragSourceType === 'board' && targetType === 'rack') {
        // 从游戏板拖回玩家牌架
        const groupIndex = gameState.dragSourceIndex;
        let tileToDrag = null;
        let tileIndex = -1;

        // 查找要拖拽的牌
        for (let i = 0; i < gameState.board[groupIndex].length; i++) {
            if (gameState.board[groupIndex][i].id === tileId) {
                tileToDrag = gameState.board[groupIndex][i];
                tileIndex = i;
                break;
            }
        }

        if (tileToDrag) {
            // 从牌组中移除
            gameState.board[groupIndex].splice(tileIndex, 1);

            // 如果牌组变空，移除牌组
            if (gameState.board[groupIndex].length === 0) {
                gameState.board.splice(groupIndex, 1);
            }

            // 添加到玩家牌架
            gameState.players[0].rack.push(tileToDrag);
            sortPlayerRack(gameState.players[0]);
        }
    } else if (gameState.dragSourceType === 'board' && targetType === 'board') {
        // 从游戏板的一个位置拖到另一个位置
        const sourceGroupIndex = gameState.dragSourceIndex;

        // 如果源组和目标组相同，不做任何处理
        if (sourceGroupIndex === targetGroupIndex) {
            return;
        }

        let tileToDrag = null;
        let tileIndex = -1;

        // 查找要拖拽的牌
        for (let i = 0; i < gameState.board[sourceGroupIndex].length; i++) {
            if (gameState.board[sourceGroupIndex][i].id === tileId) {
                tileToDrag = gameState.board[sourceGroupIndex][i];
                tileIndex = i;
                break;
            }
        }

        if (tileToDrag) {
            // 从源牌组移除
            gameState.board[sourceGroupIndex].splice(tileIndex, 1);

            // 如果源牌组变空，移除牌组
            if (gameState.board[sourceGroupIndex].length === 0) {
                gameState.board.splice(sourceGroupIndex, 1);

                // 如果目标牌组索引大于源牌组索引，需要调整索引
                if (targetGroupIndex > sourceGroupIndex) {
                    targetGroupIndex--;
                }
            }

            // 添加到目标牌组
            if (targetGroupIndex >= gameState.board.length) {
                // 创建新组
                addToBoard([tileToDrag]);
            } else {
                // 添加到现有组
                gameState.board[targetGroupIndex].push(tileToDrag);
            }
        }
    }

    // 对所有组进行排序
    sortAllGroups();

    // 更新UI
    updateUI();
}

// 处理干预模式下的拖拽开始
function handleInterventionDragStart(event) {
    // 存储被拖拽的牌信息
    const tileEl = event.target;

    // 根据数据源类型处理
    if (tileEl.dataset.source === 'intervention-rack') {
        // 从AI牌架拖拽
        const tileIndex = parseInt(tileEl.dataset.index);
        gameState.draggedTile = gameState.interventionAIPlayer.rack[tileIndex];
        gameState.dragSourceType = 'intervention-rack';
        gameState.dragSourceIndex = tileIndex;
    } else if (tileEl.dataset.source === 'board') {
        // 从游戏板拖拽
        const groupIndex = parseInt(tileEl.dataset.groupIndex);
        const tileIndex = parseInt(tileEl.dataset.tileIndex);

        gameState.draggedTile = gameState.board[groupIndex][tileIndex];
        gameState.dragSourceType = 'board';
        gameState.dragSourceIndex = groupIndex;
        gameState.dragSourceTileIndex = tileIndex;
    }

    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tileEl.dataset.id);

    // 设置半透明效果
    setTimeout(() => {
        tileEl.classList.add('dragging');
    }, 0);

    // 临时隐藏AI干预面板（如果有）
    const interventionPanel = document.getElementById('intervention-panel');
    if (interventionPanel) {
        interventionPanel.classList.add('hidden');
    }
}

// 处理干预模式下的拖放
function handleInterventionDrop(event) {
    event.preventDefault();

    if (!gameState.draggedTile) return;

    // 获取目标位置信息
    const groupEl = event.target.closest('.tile-group');
    if (!groupEl) return;

    const targetGroupIndex = parseInt(groupEl.dataset.groupIndex);

    if (gameState.dragSourceType === 'board') {
        // 从游戏板拖到游戏板的另一个位置

        // 从源组移除牌
        const sourceGroup = gameState.board[gameState.dragSourceIndex];
        const tile = sourceGroup.splice(gameState.dragSourceTileIndex, 1)[0];

        // 如果源组变空，则移除该组
        if (sourceGroup.length === 0) {
            gameState.board.splice(gameState.dragSourceIndex, 1);
        }

        if (targetGroupIndex >= gameState.board.length) {
            // 创建新组
            addToBoard([tile]);
        } else {
            // 添加到现有组
            gameState.board[targetGroupIndex].push(tile);
        }
    }

    // 对所有组进行排序
    sortAllGroups();

    // 更新UI，保持干预模式
    updateUI(true);
}

// 导出AI干预相关功能
export { aiTurn }; 