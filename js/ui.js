// UI相关函数模块
import { gameState } from './gameState.js';
import { getTileDescription } from './deck.js';
import { validateBoard, isValidCombination } from './validation.js';

// DOM元素引用
let boardEl, playerRackEl, aiRacks, startGameBtn, drawTileBtn, endTurnBtn, messagesEl;

// 初始化UI元素引用
export function initUIElements() {
    boardEl = document.getElementById('board');
    playerRackEl = document.getElementById('player-rack');
    aiRacks = [
        document.getElementById('ai1-rack'),
        document.getElementById('ai2-rack'),
        document.getElementById('ai3-rack')
    ];
    startGameBtn = document.getElementById('start-game');
    drawTileBtn = document.getElementById('draw-tile');
    endTurnBtn = document.getElementById('end-turn');
    messagesEl = document.getElementById('messages');
}

// 更新整个游戏UI
export function updateUI() {
    updatePlayerRack();
    updateAIRacks();
    updateBoard();
    updateButtons();
}

// 更新按钮状态
export function updateButtons() {
    if (!startGameBtn || !drawTileBtn || !endTurnBtn) {
        console.error('按钮元素未初始化');
        return;
    }

    // 记录当前状态，用于调试
    console.log(`游戏状态: 
        gameStarted=${gameState.gameStarted}, 
        currentPlayer=${gameState.currentPlayer}, 
        deckLength=${gameState.deck.length}, 
        aiAnimating=${gameState.aiAnimating}`);

    // 开始游戏按钮 - 游戏已开始则禁用
    startGameBtn.disabled = gameState.gameStarted;

    // 抽牌按钮 - 只有在游戏已开始、当前是玩家回合且牌堆非空时启用
    // 添加检查：确保AI不在动画中
    drawTileBtn.disabled = !gameState.gameStarted ||
        gameState.currentPlayer !== 0 ||
        gameState.deck.length === 0 ||
        gameState.aiAnimating;

    // 结束回合按钮 - 游戏已开始、当前是玩家回合且棋盘有效时启用
    // 添加检查：确保AI不在动画中
    const validBoard = validateBoard();
    endTurnBtn.disabled = !gameState.gameStarted ||
        gameState.currentPlayer !== 0 ||
        !validBoard ||
        gameState.aiAnimating;

    // 记录按钮状态，用于调试
    console.log(`按钮状态: startGame=${!startGameBtn.disabled}, drawTile=${!drawTileBtn.disabled}, endTurn=${!endTurnBtn.disabled}`);
}

// 更新玩家牌架
export function updatePlayerRack() {
    if (!playerRackEl) return;

    // 清空现有内容
    playerRackEl.innerHTML = '';

    // 首先按照花色分组玩家的牌
    const colorGroups = {};
    // 小丑牌单独处理
    const jokers = [];

    const player = gameState.players[0];
    player.rack.forEach((tile, index) => {
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
                tileEl.dataset.index = item.index;
                tileEl.dataset.id = item.tile.id;

                // 添加拖拽功能
                tileEl.draggable = true;
                tileEl.dataset.source = 'rack';
                tileEl.addEventListener('dragstart', handleDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);

                // 点击选择功能
                tileEl.addEventListener('click', () => selectTile(item.index));

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
            tileEl.dataset.index = item.index;
            tileEl.dataset.id = item.tile.id;

            // 添加拖拽功能
            tileEl.draggable = true;
            tileEl.dataset.source = 'rack';
            tileEl.addEventListener('dragstart', handleDragStart);
            tileEl.addEventListener('dragend', handleDragEnd);

            // 点击选择功能
            tileEl.addEventListener('click', () => selectTile(item.index));

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

// 更新AI牌架
export function updateAIRacks() {
    for (let i = 0; i < 3; i++) {
        const rackEl = aiRacks[i];
        if (!rackEl) continue;

        // 清空现有内容
        rackEl.innerHTML = '';

        // 按花色分组AI玩家的牌
        const colorGroups = {};
        const jokers = [];
        const aiPlayer = gameState.players[i + 1];

        // 按花色分组AI玩家的牌
        aiPlayer.rack.forEach(tile => {
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
                    rackEl.appendChild(colorRow);
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
                rackEl.appendChild(jokerRow);
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
                    rackEl.appendChild(colorRow);
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
                rackEl.appendChild(jokerRow);
            }
        }
    }
}

// 更新游戏板
export function updateBoard(isIntervention = false) {
    // 首先对所有组合进行排序
    sortAllGroups();

    if (!boardEl) return;

    // 清空现有内容
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
            tileEl.dataset.id = tile.id;

            // 拖拽事件，区分干预模式
            if (isIntervention) {
                tileEl.addEventListener('dragstart', handleInterventionDragStart);
                tileEl.addEventListener('dragend', handleDragEnd);
            } else {
                tileEl.addEventListener('dragstart', handleBoardDragStart);
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

// 游戏板上的牌拖拽开始
export function handleBoardDragStart(event) {
    // 如果不是玩家回合，不允许拖拽
    if (gameState.currentPlayer !== 0) {
        event.preventDefault();
        return;
    }

    // 如果是第一次修改棋盘，保存原始状态
    if (!gameState.boardModified && gameState.board.length > 0) {
        saveOriginalBoard();
        gameState.boardModified = true;
    }

    // 存储被拖拽的牌信息
    const tileEl = event.target;
    const groupIndex = parseInt(tileEl.dataset.groupIndex);
    const tileIndex = parseInt(tileEl.dataset.tileIndex);

    // 设置拖拽源信息
    gameState.draggedTile = gameState.board[groupIndex][tileIndex];
    gameState.dragSourceType = 'board';
    gameState.dragSourceIndex = groupIndex;
    gameState.draggedTileIndex = tileIndex;

    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tileEl.dataset.id);

    // 设置半透明效果
    setTimeout(() => {
        tileEl.classList.add('dragging');
    }, 0);
}

// 为所有牌组排序
export function sortAllGroups() {
    gameState.board = gameState.board.map(group => sortGroup(group));
}

// 创建牌元素
export function createTileElement(tile) {
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

// 记录消息
export function logMessage(message) {
    if (!messagesEl) return;

    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.textContent = message;

    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // 限制消息数量
    while (messagesEl.children.length > 10) {
        messagesEl.removeChild(messagesEl.firstChild);
    }
}

// 获取详细的组合信息（用于日志）
export function getDetailedGroupInfo(newGroupCount, totalPoints, originalGroups, isPlayer = true) {
    let message = '';

    if (isPlayer) {
        message += `你`;
    } else {
        message += `AI玩家`;
    }

    if (newGroupCount > 0) {
        message += `创建了${newGroupCount}个新组合`;
        if (totalPoints > 0) {
            message += `，总分值${totalPoints}。`;
        } else {
            message += `。`;
        }
    } else {
        message += `什么也没做。`;
    }

    // 可以在这里添加更详细的信息，例如每个组合包含什么牌

    return message;
}

// 对当前的组合进行排序
export function sortGroup(group) {
    // 先尝试按照数字顺序排序（适用于顺子）
    let sortedGroup = [...group].sort((a, b) => {
        if (a.color === 'joker' && b.color === 'joker') return 0;
        if (a.color === 'joker') return -1; // 百搭牌放前面
        if (b.color === 'joker') return 1;
        return a.number - b.number;
    });

    // 如果不是顺子（是同数字组），则按颜色排序
    const isRun = sortedGroup.every((tile, i, arr) => {
        if (i === 0) return true;
        if (tile.color === 'joker' || arr[i - 1].color === 'joker') return true;
        return arr[i - 1].color === tile.color;
    });

    if (!isRun) {
        // 如果是同数字组，按颜色排序
        sortedGroup = [...group].sort((a, b) => {
            if (a.color === 'joker' && b.color === 'joker') return 0;
            if (a.color === 'joker') return -1; // 百搭牌放前面
            if (b.color === 'joker') return 1;

            const colorOrder = { 'red': 0, 'blue': 1, 'yellow': 2, 'black': 3 };
            return colorOrder[a.color] - colorOrder[b.color];
        });
    }

    return sortedGroup;
}

// 处理拖拽开始
export function handleDragStart(event) {
    // 存储被拖拽的牌信息
    const tileEl = event.target;
    const tileIndex = parseInt(tileEl.dataset.index);
    gameState.draggedTile = gameState.players[0].rack[tileIndex];
    gameState.dragSourceType = 'rack';
    gameState.dragSourceIndex = tileIndex;

    // 设置拖拽效果
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tileEl.dataset.id);

    // 设置半透明效果
    setTimeout(() => {
        tileEl.classList.add('dragging');
    }, 0);
}

// 处理拖拽结束
export function handleDragEnd(event) {
    // 移除半透明效果
    event.target.classList.remove('dragging');

    // 清除拖拽状态
    gameState.draggedTile = null;
    gameState.dragSourceType = null;
    gameState.dragSourceIndex = -1;
}

// 处理拖拽悬停
export function handleDragOver(event) {
    // 允许放置
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

// 选择牌
export function selectTile(index) {
    // 实现选择牌的逻辑
    console.log(`选择了索引为 ${index} 的牌`);
}

// 导出处理拖放的函数，这些函数会在main.js中被实现
export let handleDrop;
export let handleInterventionDragStart;
export let handleInterventionDrop;

// 设置处理拖放的函数
export function setDragDropHandlers(dropHandler, interventionDragStartHandler, interventionDropHandler) {
    handleDrop = dropHandler;
    handleInterventionDragStart = interventionDragStartHandler;
    handleInterventionDrop = interventionDropHandler;
} 