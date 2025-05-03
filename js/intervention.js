// 人类干预AI模式功能模块
import { gameState } from './gameState.js';
import { validateBoard } from './validation.js';

// 确认是否需要人类干预
export function confirmHumanIntervention(aiPlayer) {
    // 如果AI有牌可以出，则提示玩家是否干预
    const message = `${aiPlayer.name}正准备出牌。你想查看他们的牌并干预吗？`;
    return confirm(message);
}

// 启用人类干预模式
export function enableHumanIntervention(aiPlayer, updateUI) {
    gameState.humanInterventionMode = true;
    gameState.interventionAIPlayer = aiPlayer;

    // 更新UI以显示干预模式
    updateInterventionUI(updateUI);
}

// 更新干预模式下的UI
function updateInterventionUI(updateUI) {
    if (!gameState.humanInterventionMode) return;

    // 显示AI玩家的牌
    updateUI(true);

    // 显示干预控制界面
    const controlsEl = document.createElement('div');
    controlsEl.className = 'intervention-controls';
    controlsEl.innerHTML = `
        <div class="intervention-message">你正在干预${gameState.interventionAIPlayer.name}的操作</div>
        <button id="finish-intervention">完成干预</button>
        <button id="cancel-intervention">取消干预</button>
    `;

    document.body.appendChild(controlsEl);

    // 添加干预控制按钮的事件监听
    document.getElementById('finish-intervention').addEventListener('click', () => finishHumanIntervention(updateUI));
    document.getElementById('cancel-intervention').addEventListener('click', () => cancelHumanIntervention(updateUI));
}

// 完成人类干预
export function finishHumanIntervention(updateUI) {
    // 验证棋盘状态
    if (!validateBoard()) {
        alert('游戏板上有无效的组合，请调整后再完成干预');
        return;
    }

    // 清除干预模式
    gameState.humanInterventionMode = false;
    gameState.interventionAIPlayer = null;

    // 移除干预控制界面
    const controlsEl = document.querySelector('.intervention-controls');
    if (controlsEl) {
        document.body.removeChild(controlsEl);
    }

    // 更新UI，恢复正常游戏状态
    updateUI();
}

// 取消人类干预
export function cancelHumanIntervention(updateUI) {
    // 清除干预模式
    gameState.humanInterventionMode = false;
    gameState.interventionAIPlayer = null;

    // 移除干预控制界面
    const controlsEl = document.querySelector('.intervention-controls');
    if (controlsEl) {
        document.body.removeChild(controlsEl);
    }

    // 更新UI，恢复正常游戏状态
    updateUI();
} 