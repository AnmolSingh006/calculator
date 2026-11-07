/**
 * Calc. — Modern Precision Calculator
 * Production-quality Vanilla JavaScript Application
 * 
 * Features:
 * - Token-based calculation engine with operator precedence (no eval)
 * - Clean floating-point precision handling
 * - Comprehensive keyboard support with tactile visual feedback
 * - Persistent calculation history (localStorage)
 * - Seamless Light / Dark theme switching
 * - Interactive display with dynamic font scaling and click-to-copy
 */

'use strict';

// ==========================================================================
// 1. Calculation Engine & Math Helpers
// ==========================================================================

class CalculatorEngine {
  /**
   * Cleans floating point numbers to prevent IEEE-754 precision artifacts
   * e.g., 0.1 + 0.2 = 0.3 instead of 0.30000000000000004
   * @param {number} num
   * @returns {number}
   */
  static cleanPrecision(num) {
    if (!Number.isFinite(num)) return num;
    // Round to 12 significant digits and parse back to float
    return parseFloat(Number(num).toPrecision(12));
  }

  /**
   * Evaluates an array of tokens (numbers and operator strings)
   * respecting standard mathematical operator precedence:
   * 1. Multiplication (×) and Division (÷)
   * 2. Addition (+) and Subtraction (−)
   * 
   * @param {Array<number|string>} tokens
   * @returns {number}
   */
  static evaluate(tokens) {
    if (!tokens || tokens.length === 0) return 0;
    if (tokens.length === 1) return tokens[0];

    // Pass 1: Multiplication and Division (left-to-right)
    const pass1 = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      if (token === '×' || token === '*' || token === '÷' || token === '/') {
        const left = pass1.pop();
        const right = tokens[i + 1];

        if (right === undefined) {
          pass1.push(left);
          break;
        }

        if ((token === '÷' || token === '/') && right === 0) {
          throw new Error('Cannot divide by zero');
        }

        let result;
        if (token === '×' || token === '*') {
          result = left * right;
        } else {
          result = left / right;
        }

        pass1.push(this.cleanPrecision(result));
        i += 2; // Advance past operator and right operand
      } else {
        pass1.push(token);
        i++;
      }
    }

    if (pass1.length === 0) return 0;

    // Pass 2: Addition and Subtraction (left-to-right)
    let accumulator = pass1[0];
    let j = 1;

    while (j < pass1.length) {
      const op = pass1[j];
      const nextVal = pass1[j + 1];

      if (nextVal === undefined) break;

      if (op === '+') {
        accumulator += nextVal;
      } else if (op === '−' || op === '-') {
        accumulator -= nextVal;
      }

      accumulator = this.cleanPrecision(accumulator);
      j += 2;
    }

    return accumulator;
  }
}

// ==========================================================================
// 2. Calculator UI & State Controller
// ==========================================================================

class CalculatorApp {
  constructor() {
    // Calculator Core State
    this.currentInput = '0';
    this.expressionTokens = [];
    this.isEvaluated = false;
    this.activeOperator = null;
    this.hasError = false;
    this.lastOperation = null; // Used for repeated '=' operations

    // History Storage
    this.history = this.loadHistory();

    // Cache DOM Elements
    this.dom = {
      display: document.getElementById('calculator-display'),
      displayCurrent: document.getElementById('display-current'),
      displayExpression: document.getElementById('display-expression'),
      btnClearLabel: document.getElementById('btn-clear-label'),
      copyToast: document.getElementById('copy-toast'),
      themeToggleBtn: document.getElementById('theme-toggle-btn'),
      historyToggleBtn: document.getElementById('history-toggle-btn'),
      historyPanel: document.getElementById('history-panel'),
      historyList: document.getElementById('history-list'),
      historyEmpty: document.getElementById('history-empty'),
      historyClearBtn: document.getElementById('history-clear-btn'),
      historyCloseBtn: document.getElementById('history-close-btn'),
      historyBadge: document.getElementById('history-badge'),
      historyCountText: document.getElementById('history-count-text'),
      keypad: document.querySelector('.keypad-grid'),
    };

    // Initialize Components
    this.initTheme();
    this.renderHistory();
    this.bindEvents();
    this.updateDisplay();
  }

  // ------------------------------------------------------------------------
  // Number Formatting & Display Utilities
  // ------------------------------------------------------------------------

  /**
   * Formats a raw number string with thousands separators while preserving
   * ongoing user inputs like trailing decimals or negative zeros.
   * @param {string} valStr 
   * @returns {string}
   */
  formatNumberForDisplay(valStr) {
    if (this.hasError || valStr === 'Error' || valStr === 'Cannot divide by zero') {
      return valStr;
    }
    if (valStr === '' || valStr === '-' || valStr === '-0') {
      return valStr;
    }
    if (valStr.includes('e') || valStr.includes('E')) {
      return valStr;
    }

    const parts = valStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];

    // Add thousands commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    if (parts.length > 1) {
      return `${formattedInteger}.${decimalPart}`;
    }
    return formattedInteger;
  }

  /**
   * Dynamically adjusts the font size of the primary output to prevent overflow
   */
  adjustDisplayFontSize() {
    const textLength = this.dom.displayCurrent.textContent.length;
    this.dom.displayCurrent.classList.remove('size-medium', 'size-small', 'size-xsmall');

    if (textLength > 15) {
      this.dom.displayCurrent.classList.add('size-xsmall');
    } else if (textLength > 12) {
      this.dom.displayCurrent.classList.add('size-small');
    } else if (textLength > 9) {
      this.dom.displayCurrent.classList.add('size-medium');
    }
  }

  /**
   * Returns the running intermediate total of expressionTokens when currentInput is empty
   * @returns {string}
   */
  getRunningDisplayValue() {
    if (this.currentInput !== '') {
      return this.currentInput;
    }

    if (this.expressionTokens.length > 0) {
      const tokensToEval = [];
      for (const t of this.expressionTokens) {
        if (typeof t === 'number') {
          tokensToEval.push(t);
        } else if (tokensToEval.length > 0) {
          tokensToEval.push(t);
        }
      }
      // If ends with an operator, pop it for intermediate evaluation
      if (typeof tokensToEval[tokensToEval.length - 1] === 'string') {
        tokensToEval.pop();
      }

      if (tokensToEval.length > 0) {
        try {
          const intermediate = CalculatorEngine.evaluate(tokensToEval);
          return String(intermediate);
        } catch (e) {
          return '0';
        }
      }
    }

    return '0';
  }

  /**
   * Refreshes the display DOM, expression line, and dynamic button labels
   */
  updateDisplay() {
    // Current input display
    const rawVal = this.hasError ? this.currentInput : this.getRunningDisplayValue();
    this.dom.displayCurrent.textContent = this.formatNumberForDisplay(rawVal);
    this.adjustDisplayFontSize();

    // Expression line display
    let exprText = '';
    if (this.expressionTokens.length > 0) {
      exprText = this.expressionTokens.map(token => {
        if (typeof token === 'number') {
          return this.formatNumberForDisplay(String(token));
        }
        return token;
      }).join(' ');
    }

    if (this.isEvaluated) {
      this.dom.displayExpression.textContent = `${exprText} =`;
    } else {
      this.dom.displayExpression.textContent = exprText;
    }

    // Toggle AC vs C label:
    // Shows 'C' when typing an uncommitted operand; 'AC' when at zero or evaluated
    if (this.hasError || this.isEvaluated || (this.currentInput === '0' && this.expressionTokens.length === 0)) {
      this.dom.btnClearLabel.textContent = 'AC';
    } else {
      this.dom.btnClearLabel.textContent = this.currentInput !== '' && this.currentInput !== '0' ? 'C' : 'AC';
    }

    // Update active operator highlight
    document.querySelectorAll('.btn-operator').forEach(btn => {
      const op = btn.getAttribute('data-operator');
      if (this.activeOperator && op === this.activeOperator && this.currentInput === '') {
        btn.classList.add('is-active-op');
      } else {
        btn.classList.remove('is-active-op');
      }
    });
  }

  // ------------------------------------------------------------------------
  // Core Calculator Input Actions
  // ------------------------------------------------------------------------

  /**
   * Handles digit input (0–9)
   * @param {string} digit 
   */
  inputDigit(digit) {
    if (this.hasError) {
      this.clearAll();
    }

    if (this.isEvaluated) {
      // Start a fresh calculation if a digit is pressed after '='
      this.expressionTokens = [];
      this.currentInput = digit;
      this.isEvaluated = false;
      this.lastOperation = null;
    } else if (this.currentInput === '0') {
      this.currentInput = digit;
    } else if (this.currentInput === '-0' || this.currentInput === '-') {
      this.currentInput = `-${digit}`;
    } else {
      // Limit to 15 digits
      const pureDigits = this.currentInput.replace(/[^0-9]/g, '');
      if (pureDigits.length >= 15) return;
      this.currentInput += digit;
    }

    this.activeOperator = null;
    this.updateDisplay();
  }

  /**
   * Handles decimal point (.)
   */
  inputDecimal() {
    if (this.hasError) {
      this.clearAll();
    }

    if (this.isEvaluated) {
      this.expressionTokens = [];
      this.currentInput = '0.';
      this.isEvaluated = false;
      this.lastOperation = null;
    } else if (this.currentInput === '' || this.currentInput === '0') {
      this.currentInput = '0.';
    } else if (this.currentInput === '-') {
      this.currentInput = '-0.';
    } else if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }

    this.activeOperator = null;
    this.updateDisplay();
  }

  /**
   * Backspace: deletes the last entered digit or reverses active operator
   */
  deleteLastDigit() {
    if (this.hasError || this.isEvaluated) {
      this.clearAll();
      return;
    }

    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      if (this.currentInput === '' || this.currentInput === '-') {
        this.currentInput = '0';
      }
    } else if (this.expressionTokens.length > 0) {
      // If current input is empty, backspace removes the operator and restores the previous number
      this.expressionTokens.pop(); // Pop operator
      const prevNum = this.expressionTokens.pop(); // Pop number
      if (prevNum !== undefined) {
        this.currentInput = String(prevNum);
      }
      this.activeOperator = null;
    }

    this.updateDisplay();
  }

  /**
   * Toggles positive/negative sign (±)
   */
  toggleSign() {
    if (this.hasError) return;

    if (this.isEvaluated) {
      const num = parseFloat(this.currentInput);
      if (!Number.isNaN(num) && num !== 0) {
        this.currentInput = String(-num);
        this.isEvaluated = false;
        this.expressionTokens = [];
        this.lastOperation = null;
      }
      this.updateDisplay();
      return;
    }

    if (this.currentInput === '' || this.currentInput === '0') {
      this.currentInput = '-0';
      this.updateDisplay();
      return;
    }

    if (this.currentInput === '-0') {
      this.currentInput = '0';
      this.updateDisplay();
      return;
    }

    if (this.currentInput.startsWith('-')) {
      this.currentInput = this.currentInput.slice(1);
    } else {
      this.currentInput = `-${this.currentInput}`;
    }

    this.updateDisplay();
  }

  /**
   * Calculates percentage (%)
   * Context-aware percentage handling:
   * - In 100 + 10%, calculates 10% of 100 (= 10) -> 110
   * - In 200 × 15%, calculates 15% of 1 (= 0.15) -> 30
   * - Standalone 50% -> 0.5
   */
  inputPercentage() {
    if (this.hasError) return;

    let targetVal = this.currentInput === '' ? parseFloat(this.getRunningDisplayValue()) : parseFloat(this.currentInput);
    if (Number.isNaN(targetVal)) return;

    if (this.expressionTokens.length >= 2) {
      const prevNum = this.expressionTokens[this.expressionTokens.length - 2];
      const op = this.expressionTokens[this.expressionTokens.length - 1];

      if (op === '+' || op === '−') {
        const pct = CalculatorEngine.cleanPrecision(prevNum * (targetVal / 100));
        this.currentInput = String(pct);
      } else {
        const pct = CalculatorEngine.cleanPrecision(targetVal / 100);
        this.currentInput = String(pct);
      }
    } else {
      const pct = CalculatorEngine.cleanPrecision(targetVal / 100);
      this.currentInput = String(pct);
    }

    if (this.isEvaluated) {
      this.isEvaluated = false;
      this.expressionTokens = [];
    }

    this.updateDisplay();
  }

  /**
   * Sets mathematical operator (+, −, ×, ÷)
   * Supports chaining and operator replacement
   * @param {string} op 
   */
  setOperator(op) {
    if (this.hasError) {
      this.clearAll();
      return;
    }

    if (this.isEvaluated) {
      // Continue chaining calculation with previous result
      const prevResult = parseFloat(this.currentInput);
      this.expressionTokens = [prevResult, op];
      this.currentInput = '';
      this.isEvaluated = false;
      this.activeOperator = op;
      this.lastOperation = null;
      this.updateDisplay();
      return;
    }

    if (this.currentInput !== '') {
      const num = parseFloat(this.currentInput);
      this.expressionTokens.push(num);
      this.expressionTokens.push(op);
      this.currentInput = '';
      this.activeOperator = op;
    } else if (this.expressionTokens.length > 0) {
      // User changed their mind and clicked a different operator
      this.expressionTokens[this.expressionTokens.length - 1] = op;
      this.activeOperator = op;
    }

    this.updateDisplay();
  }

  /**
   * Evaluates the full calculation expression (=)
   */
  calculate() {
    if (this.hasError) return;

    // Handle repeated equals press (e.g., 5 + 3 = 8 = 11 = 14)
    if (this.isEvaluated && this.lastOperation) {
      const currentVal = parseFloat(this.currentInput);
      this.expressionTokens = [currentVal, this.lastOperation.op, this.lastOperation.operand];
    } else if (this.currentInput !== '') {
      const num = parseFloat(this.currentInput);
      this.expressionTokens.push(num);
      this.currentInput = '';
    } else if (this.expressionTokens.length > 0) {
      // Remove trailing operator if no second operand was entered
      const lastToken = this.expressionTokens[this.expressionTokens.length - 1];
      if (typeof lastToken === 'string') {
        this.expressionTokens.pop();
      }
    }

    if (this.expressionTokens.length === 0) return;

    // Save last operation for repeated equals support
    if (this.expressionTokens.length >= 3) {
      const op = this.expressionTokens[this.expressionTokens.length - 2];
      const operand = this.expressionTokens[this.expressionTokens.length - 1];
      if (typeof op === 'string' && typeof operand === 'number') {
        this.lastOperation = { op, operand };
      }
    }

    // Build human-readable expression string for history
    const expressionString = this.expressionTokens.map(token => {
      if (typeof token === 'number') {
        return this.formatNumberForDisplay(String(token));
      }
      return token;
    }).join(' ');

    try {
      const result = CalculatorEngine.evaluate(this.expressionTokens);
      const formattedResult = String(result);

      // Record completed calculation to history
      this.addToHistory(expressionString, this.formatNumberForDisplay(formattedResult));

      this.currentInput = formattedResult;
      this.isEvaluated = true;
      this.activeOperator = null;
      this.hasError = false;
    } catch (err) {
      this.hasError = true;
      this.currentInput = err.message || 'Error';
      this.expressionTokens = [];
      this.activeOperator = null;
      this.lastOperation = null;
    }

    this.updateDisplay();
  }

  /**
   * Clears active entry or entire state (C / AC)
   */
  clear() {
    if (this.hasError || this.dom.btnClearLabel.textContent === 'AC') {
      this.clearAll();
    } else {
      // Clear current uncommitted operand only (C)
      this.currentInput = '0';
      this.updateDisplay();
    }
  }

  /**
   * Full reset (AC)
   */
  clearAll() {
    this.currentInput = '0';
    this.expressionTokens = [];
    this.isEvaluated = false;
    this.activeOperator = null;
    this.hasError = false;
    this.lastOperation = null;
    this.updateDisplay();
  }

  // ------------------------------------------------------------------------
  // Calculation History & Persistence
  // ------------------------------------------------------------------------

  loadHistory() {
    try {
      const saved = localStorage.getItem('calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('calc_history', JSON.stringify(this.history));
    } catch (e) {
      // Handled silently
    }
  }

  addToHistory(expression, result) {
    const item = {
      id: Date.now(),
      expression: `${expression} =`,
      result: result,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.history.unshift(item);
    if (this.history.length > 40) {
      this.history.pop();
    }
    this.saveHistory();
    this.renderHistory();
  }

  renderHistory() {
    const count = this.history.length;
    this.dom.historyCountText.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    
    // Header badge indicator
    if (count > 0) {
      this.dom.historyBadge.textContent = count > 9 ? '9+' : String(count);
      this.dom.historyBadge.classList.add('has-items');
      this.dom.historyEmpty.style.display = 'none';
      this.dom.historyList.style.display = 'flex';
    } else {
      this.dom.historyBadge.classList.remove('has-items');
      this.dom.historyEmpty.style.display = 'flex';
      this.dom.historyList.style.display = 'none';
    }

    // Render list items
    this.dom.historyList.innerHTML = '';
    this.history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.tabIndex = 0;
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label', `${item.expression} ${item.result}`);

      el.innerHTML = `
        <div class="history-item-expr">${this.escapeHTML(item.expression)}</div>
        <div class="history-item-res">${this.escapeHTML(item.result)}</div>
      `;

      // Click or Enter to reuse earlier result in calculator
      const selectItem = () => {
        const cleanVal = item.result.replace(/,/g, '');
        this.currentInput = cleanVal;
        this.expressionTokens = [];
        this.isEvaluated = true;
        this.hasError = false;
        this.activeOperator = null;
        this.lastOperation = null;
        this.updateDisplay();
        this.closeHistory();
      };

      el.addEventListener('click', selectItem);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectItem();
        }
      });

      this.dom.historyList.appendChild(el);
    });
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.renderHistory();
  }

  toggleHistory() {
    const isOpen = this.dom.historyPanel.classList.contains('is-open');
    if (isOpen) {
      this.closeHistory();
    } else {
      this.openHistory();
    }
  }

  openHistory() {
    this.dom.historyPanel.classList.add('is-open');
    this.dom.historyPanel.setAttribute('aria-hidden', 'false');
  }

  closeHistory() {
    this.dom.historyPanel.classList.remove('is-open');
    this.dom.historyPanel.setAttribute('aria-hidden', 'true');
  }

  // ------------------------------------------------------------------------
  // Theme Management
  // ------------------------------------------------------------------------

  initTheme() {
    const savedTheme = localStorage.getItem('calc_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('calc_theme', newTheme);
  }

  // ------------------------------------------------------------------------
  // Clipboard Copy Feedback
  // ------------------------------------------------------------------------

  async copyDisplayToClipboard() {
    const text = this.dom.displayCurrent.textContent;
    if (!text || text === 'Error' || text === 'Cannot divide by zero') return;

    try {
      await navigator.clipboard.writeText(text);
      this.showToast();
    } catch (e) {
      // Fallback for restricted clipboard environments
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showToast();
      } catch (err) {
        // Fallback silent fail
      }
      document.body.removeChild(textarea);
    }
  }

  showToast() {
    this.dom.copyToast.classList.add('visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.dom.copyToast.classList.remove('visible');
    }, 1500);
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // ------------------------------------------------------------------------
  // Event Listeners & Keyboard Support
  // ------------------------------------------------------------------------

  bindEvents() {
    // Keypad Click Delegation
    this.dom.keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.calc-btn');
      if (!btn) return;

      const number = btn.getAttribute('data-number');
      const action = btn.getAttribute('data-action');
      const operator = btn.getAttribute('data-operator');

      if (number !== null) {
        this.inputDigit(number);
      } else if (action === 'operator' && operator) {
        this.setOperator(operator);
      } else if (action === 'calculate') {
        this.calculate();
      } else if (action === 'clear') {
        this.clear();
      } else if (action === 'decimal') {
        this.inputDecimal();
      } else if (action === 'toggle-sign') {
        this.toggleSign();
      } else if (action === 'percentage') {
        this.inputPercentage();
      } else if (action === 'toggle-history') {
        this.toggleHistory();
      }
    });

    // Theme Toggle Button
    this.dom.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // History Toggle Buttons & Actions
    this.dom.historyToggleBtn.addEventListener('click', () => this.toggleHistory());
    this.dom.historyCloseBtn.addEventListener('click', () => this.closeHistory());
    this.dom.historyClearBtn.addEventListener('click', () => this.clearHistory());

    // Copy on Display Click
    this.dom.display.addEventListener('click', () => this.copyDisplayToClipboard());
    this.dom.display.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.copyDisplayToClipboard();
      }
    });

    // Physical Keyboard Support
    window.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
    window.addEventListener('keyup', (e) => this.handleKeyboardKeyUp(e));
  }

  /**
   * Maps physical keyboard keys to calculator actions
   * @param {KeyboardEvent} e 
   */
  handleKeyboardInput(e) {
    // Avoid capturing inputs if focus is inside another text field
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    const key = e.key;
    let buttonToHighlight = null;

    if (key >= '0' && key <= '9') {
      e.preventDefault();
      this.inputDigit(key);
      buttonToHighlight = document.querySelector(`.calc-btn[data-number="${key}"]`);
    } else if (key === '.' || key === ',') {
      e.preventDefault();
      this.inputDecimal();
      buttonToHighlight = document.querySelector(`.calc-btn[data-action="decimal"]`);
    } else if (key === '+') {
      e.preventDefault();
      this.setOperator('+');
      buttonToHighlight = document.querySelector(`.calc-btn[data-operator="+"]`);
    } else if (key === '-') {
      e.preventDefault();
      this.setOperator('−');
      buttonToHighlight = document.querySelector(`.calc-btn[data-operator="−"]`);
    } else if (key === '*' || key === 'x' || key === 'X') {
      e.preventDefault();
      this.setOperator('×');
      buttonToHighlight = document.querySelector(`.calc-btn[data-operator="×"]`);
    } else if (key === '/') {
      e.preventDefault();
      this.setOperator('÷');
      buttonToHighlight = document.querySelector(`.calc-btn[data-operator="÷"]`);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      this.calculate();
      buttonToHighlight = document.querySelector(`.calc-btn[data-action="calculate"]`);
    } else if (key === 'Backspace') {
      e.preventDefault();
      this.deleteLastDigit();
    } else if (key === 'Escape') {
      e.preventDefault();
      if (this.dom.historyPanel.classList.contains('is-open')) {
        this.closeHistory();
      } else {
        this.clear();
      }
      buttonToHighlight = document.querySelector(`.calc-btn[data-action="clear"]`);
    } else if (key === '%') {
      e.preventDefault();
      this.inputPercentage();
      buttonToHighlight = document.querySelector(`.calc-btn[data-action="percentage"]`);
    } else if (key === 'h' || key === 'H') {
      e.preventDefault();
      this.toggleHistory();
      buttonToHighlight = document.querySelector(`.calc-btn[data-action="toggle-history"]`);
    }

    // Visual tactile press feedback
    if (buttonToHighlight) {
      buttonToHighlight.classList.add('is-pressed');
    }
  }

  handleKeyboardKeyUp(e) {
    document.querySelectorAll('.calc-btn.is-pressed').forEach(btn => {
      btn.classList.remove('is-pressed');
    });
  }
}

// --------------------------------------------------------------------------
// Application Bootstrap
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  window.calculatorApp = new CalculatorApp();
});
