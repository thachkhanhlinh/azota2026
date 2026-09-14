/**
 * ============================================================================
 * QUIZ SOLVER STANDALONE (STEALTH MODE - HOÀN TOÀN CHẠY NGẦM)
 * ============================================================================
 * - Không giao diện (HUD), không thông báo (Toast), không để lại dấu vết thị giác.
 * - Tự động tải dữ liệu và ngầm chọn đáp án tất cả câu hỏi ngay khi được nạp.
 * - Phím tắt ngầm:
 *     + Alt + X : Tự động chọn tất cả đáp án
 *     + Alt + C : Tự động chọn 1 câu tiếp theo
 *     + Alt + N : Bật / tắt chế độ ngầm đánh dấu đáp án (đổi góc bo kín đáo)
 *     + Click 3 lần liên tiếp: Dọn dẹp sạch sẽ
 * - Hàm trong Console:
 *     + solveAll() / solveOne() / cleanUp()
 * ============================================================================
 */

// Ghi lại URL của <script src="..."> ngay TẠI ĐÂY, trước khi IIFE chạy.
// document.currentScript chỉ hợp lệ lúc script đang parse (không phải trong async callback hay eval).
const __QUIZ_SOLVER_SCRIPT_URL__ = (function () {
  const el = document.currentScript;
  return el ? el.src : "";
})();

(function () {
  // Tránh nạp trùng lặp
  if (window.__QUIZ_SOLVER_RUNNING__) {
    if (typeof window.solveAll === "function") window.solveAll();
    return;
  }
  window.__QUIZ_SOLVER_RUNNING__ = true;

  const CONFIG = {
    githubUser: "thachkhanhlinh",
    githubRepo: "azota2026",
    branch: "main",
    answersFileName: "answers.json",
    customAnswersUrl: ""
  };

  const ANSWER_NOT_FOUND = "Không tìm thấy đáp án phù hợp.";
  const QUESTION_SELECTOR = ".question-standalone-main-content";
  const QUESTION_TEXT_SELECTOR = ".question-standalone-content-box span.ng-star-inserted";

  let answerBank = null;
  let searchIndex = [];
  let exactQuestionMap = new Map();
  const clickedQuestions = new Set();
  let autoClickInProgress = false;
  let autoHighlightInterval = null;
  let autoHighlightObserver = null;
  let pendingHighlightTimer = null;
  let cleanupClickCount = 0;
  let cleanupClickTimer = null;

  // --------------------------------------------------------------------------
  // 1. TỰ ĐỘNG XÁC ĐỊNH NGUỒN TẢI DỮ LIỆU TỪ GITHUB
  // --------------------------------------------------------------------------
  function resolveAnswersUrls() {
    if (CONFIG.customAnswersUrl) return [CONFIG.customAnswersUrl];

    // Hoạt động khi script được nạp qua <script src="..."> (Bookmarklet inject)
    // __QUIZ_SOLVER_SCRIPT_URL__ được ghi lại đúng lúc parse, không bị null như document.currentScript trong IIFE.
    if (__QUIZ_SOLVER_SCRIPT_URL__) {
      try {
        const scriptUrl = new URL(__QUIZ_SOLVER_SCRIPT_URL__);
        const answersFromScript = new URL(CONFIG.answersFileName, scriptUrl).href;
        // Chỉ trả về nếu URL có vẻ hợp lệ (không phải placeholder)
        if (!answersFromScript.includes("YOUR_USERNAME")) return [answersFromScript];
      } catch (e) {}
    }

    const { githubUser, githubRepo, branch, answersFileName } = CONFIG;
    return [
      `https://cdn.jsdelivr.net/gh/${githubUser}/${githubRepo}@${branch}/${answersFileName}`,
      `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${branch}/${answersFileName}`
    ];
  }

  async function fetchAnswerBank() {
    if (answerBank) return answerBank;

    const urls = resolveAnswersUrls();
    for (const url of urls) {
      try {
        const cacheBuster = url.includes("?") ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
        const response = await fetch(url + cacheBuster);
        if (!response.ok) continue;
        const data = await response.json();
        buildSearchIndex(data);
        answerBank = data;
        return data;
      } catch (err) {}
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 2. TÌM KIẾM ĐÁP ÁN THEO ĐỘ TRÙNG KHỚP
  // --------------------------------------------------------------------------
  function buildSearchIndex(bank) {
    exactQuestionMap = new Map();
    searchIndex = Object.keys(bank).map((question) => {
      const normalized = normalizeForSearch(question);
      const tokens = toTokenSet(normalized);
      const exactMatches = exactQuestionMap.get(normalized) || [];
      exactMatches.push(question);
      exactQuestionMap.set(normalized, exactMatches);
      return { question, normalized, tokens };
    });
  }

  function normalizeForSearch(text) {
    if (!text) return "";
    return text
      .toString()
      .normalize("NFC")
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/[.,/#!$%^&*;:{}=\-_`~()"'“”‘’[\]\\|<>?+]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toTokenSet(text) {
    return new Set(text.split(" ").filter(Boolean));
  }

  function calculateSimilarity(tokens1, tokens2) {
    if (!tokens1.size || !tokens2.size) return 0;
    let intersection = 0;
    for (const token of tokens1) {
      if (tokens2.has(token)) intersection++;
    }
    return (2 * intersection) / (tokens1.size + tokens2.size);
  }

  function findClosestQuestion(userQuestion) {
    const normalizedUserQuestion = normalizeForSearch(userQuestion);
    if (!normalizedUserQuestion) return null;

    const exactMatch = exactQuestionMap.get(normalizedUserQuestion);
    if (exactMatch) return exactMatch;

    const userTokens = toTokenSet(normalizedUserQuestion);
    let bestMatch = null;
    let highestScore = 0;

    for (const item of searchIndex) {
      const score = calculateSimilarity(userTokens, item.tokens);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item.question;
      }
    }

    return highestScore > 0.4 ? bestMatch : null;
  }

  function findAnswers(userQuestion) {
    if (!answerBank) return [ANSWER_NOT_FOUND];
    const closestQuestions = findClosestQuestion(userQuestion);
    if (!closestQuestions) return [ANSWER_NOT_FOUND];

    const questions = Array.isArray(closestQuestions) ? closestQuestions : [closestQuestions];
    const answers = [];
    const seenAnswers = new Set();

    questions.forEach((question) => {
      const questionAnswers = answerBank[question];
      const answerList = Array.isArray(questionAnswers) ? questionAnswers : [questionAnswers];

      answerList.forEach((answer) => {
        if (!seenAnswers.has(answer)) {
          answers.push(answer);
          seenAnswers.add(answer);
        }
      });
    });

    return answers.length ? answers : [ANSWER_NOT_FOUND];
  }

  // --------------------------------------------------------------------------
  // 3. THAO TÁC DOM (TỰ ĐỘNG CHỌN NGẦM & ĐÁNH DẤU TINH TẾ)
  // --------------------------------------------------------------------------
  function sanitizeText(text) {
    if (!text) return "";
    return text.replace(/\s+/g, " ").trim();
  }

  function normalizeText(text) {
    return sanitizeText(text).normalize("NFC").toLowerCase();
  }

  function findNormalizedAnswerIndex(text, normalizedAnswer) {
    if (!text || !normalizedAnswer) return -1;
    const directIndex = text.indexOf(normalizedAnswer);
    if (directIndex === -1) return -1;

    if (!isShortAnswer(normalizedAnswer)) return directIndex;
    const escapedAnswer = escapeRegExp(normalizedAnswer);
    const tokenMatch = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapedAnswer})(?=$|[^\\p{L}\\p{N}])`, "u").exec(text);
    return tokenMatch ? tokenMatch.index + tokenMatch[1].length : -1;
  }

  function isShortAnswer(answer) {
    return /^[\p{L}\p{N}]{1,2}$/u.test(answer);
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findAnswerSearchRoot(questionContainer, answers) {
    let parent = questionContainer;
    const normalizedAnswers = answers.map(normalizeText).filter(Boolean);

    while (parent && parent !== document.body) {
      const text = normalizeText(parent.innerText || parent.textContent || "");
      if (normalizedAnswers.some((ans) => findNormalizedAnswerIndex(text, ans) !== -1)) return parent;
      parent = parent.parentElement;
    }

    return document.body;
  }

  function isAnswerSelected(answers, rootElement) {
    const match = findAnswerTextMatch(answers, rootElement);
    if (!match) return false;

    let parent = match.node.parentElement;
    while (parent && parent !== document.body && parent !== rootElement.parentElement) {
      const radio = parent.querySelector && parent.querySelector('input[type="radio"]');
      if (radio) return radio.checked;

      const ariaChecked = parent.getAttribute && parent.getAttribute("aria-checked");
      if (ariaChecked === "true") return true;

      const className = typeof parent.className === "string" ? parent.className.toLowerCase() : "";
      if (/\b(active|checked|selected|is-selected|mat-radio-checked)\b/.test(className)) return true;

      parent = parent.parentElement;
    }

    return false;
  }

  function findAnswerTextMatch(answers, rootElement) {
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      if (!currentNode.parentElement || currentNode.parentElement.offsetHeight <= 0) continue;
      const text = normalizeText(currentNode.textContent);
      for (const answer of answers) {
        const normalizedAnswer = normalizeText(answer);
        if (!normalizedAnswer) continue;
        const index = findNormalizedAnswerIndex(text, normalizedAnswer);
        if (index !== -1) return { node: currentNode, answer, index };
      }
    }
    return null;
  }

  function drawHighlightAndClick(answers, questionId, doHighlight, doClick, rootElement = document.body) {
    try {
      if (!answers || answers.length === 0) return false;

      let clickedAnswer = false;
      const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
      let currentNode;

      while ((currentNode = walker.nextNode())) {
        if (!currentNode.parentElement || currentNode.parentElement.offsetHeight <= 0) continue;

        for (const answer of answers) {
          if (clickedAnswer) break;

          const text = normalizeText(currentNode.textContent);
          const normalizedAnswer = normalizeText(answer);
          const index = findNormalizedAnswerIndex(text, normalizedAnswer);
          if (index === -1) continue;

          const range = document.createRange();
          range.setStart(currentNode, index);
          range.setEnd(currentNode, index + answer.length);
          const rect = range.getBoundingClientRect();

          if (doHighlight) drawCornerHighlight(rect, questionId, currentNode.parentElement, rootElement);

          if (doClick && clickAnswerElement(currentNode.parentElement, rect, rootElement)) {
            clickedAnswer = true;
          }
        }
      }

      return clickedAnswer;
    } catch (error) {
      return false;
    }
  }

  // Đánh dấu góc bo siêu kín đáo (không lộ màu sắc)
  function drawCornerHighlight(rect, questionId, startElement, rootElement = document.body) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const target = findSubtleHighlightTarget(startElement, rootElement) || startElement;
    if (!target) return;

    applyCornerRadiusMarker(target);
    target.classList.add("extension-highlight");
    target.dataset.questionId = questionId;
  }

  function applyCornerRadiusMarker(element) {
    if (element.dataset.cornerRadiusMarkerApplied === "true") return;
    element.dataset.cornerRadiusMarkerApplied = "true";
    element.dataset.originalBorderTopLeftRadius = element.style.getPropertyValue("border-top-left-radius") || "";
    element.dataset.originalBorderTopLeftRadiusPriority = element.style.getPropertyPriority("border-top-left-radius") || "";
    element.dataset.originalBorderBottomRightRadius = element.style.getPropertyValue("border-bottom-right-radius") || "";
    element.dataset.originalBorderBottomRightRadiusPriority = element.style.getPropertyPriority("border-bottom-right-radius") || "";
    element.style.setProperty("border-top-left-radius", "0", "important");
    element.style.setProperty("border-bottom-right-radius", "0", "important");
  }

  function resetCornerRadiusMarker(element) {
    restoreStyleProperty(element, "border-top-left-radius", "originalBorderTopLeftRadius", "originalBorderTopLeftRadiusPriority");
    restoreStyleProperty(element, "border-bottom-right-radius", "originalBorderBottomRightRadius", "originalBorderBottomRightRadiusPriority");
    delete element.dataset.cornerRadiusMarkerApplied;
    delete element.dataset.originalBorderTopLeftRadius;
    delete element.dataset.originalBorderTopLeftRadiusPriority;
    delete element.dataset.originalBorderBottomRightRadius;
    delete element.dataset.originalBorderBottomRightRadiusPriority;
  }

  function restoreStyleProperty(element, prop, valKey, prioKey) {
    const val = element.dataset[valKey] || "";
    const prio = element.dataset[prioKey] || "";
    if (val) element.style.setProperty(prop, val, prio);
    else element.style.removeProperty(prop);
  }

  function removeHighlightsForQuestion(questionId) {
    document.querySelectorAll(".extension-highlight").forEach((el) => {
      if (el.dataset.questionId === questionId) {
        resetCornerRadiusMarker(el);
        delete el.dataset.questionId;
        el.classList.remove("extension-highlight");
      }
    });
  }

  function hasHighlightForQuestion(questionId) {
    return Array.from(document.querySelectorAll(".extension-highlight")).some(
      (el) => el.dataset.questionId === questionId && el.isConnected
    );
  }

  function findSubtleHighlightTarget(startElement, rootElement) {
    let parent = startElement;
    while (parent && parent !== document.body && parent !== rootElement.parentElement) {
      if (isHighlightableAnswerElement(parent, rootElement)) return parent;
      parent = parent.parentElement;
    }
    return startElement;
  }

  function isHighlightableAnswerElement(element, rootElement) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const rootRect = rootElement.getBoundingClientRect();
    const hasQuestionText = element.querySelector && element.querySelector(".question-standalone-content-box");
    const hasText = element.textContent && element.textContent.trim().length > 0;
    const isAnswerSized = rect.width > 20 && rect.height >= 20 && rect.height < rootRect.height * 0.6;
    return !hasQuestionText && hasText && isAnswerSized && isClickableAnswerElement(element);
  }

  function clickAnswerElement(startElement, textRect, rootElement) {
    try {
      if (!startElement) return false;
      if (clickByAnswerCoordinates(textRect, rootElement)) return true;

      let parent = startElement;
      while (parent && parent !== document.body && parent !== rootElement.parentElement) {
        const radio = parent.querySelector && parent.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.click();
          return true;
        }

        if (isClickableAnswerElement(parent)) {
          dispatchClick(parent);
          return true;
        }

        parent = parent.parentElement;
      }

      if (clickAnswerRow(startElement, rootElement)) return true;
      return dispatchClick(startElement);
    } catch (error) {
      return false;
    }
  }

  function clickAnswerRow(startElement, rootElement) {
    let parent = startElement;
    while (parent && parent !== document.body && parent !== rootElement.parentElement) {
      const rect = parent.getBoundingClientRect();
      const rootRect = rootElement.getBoundingClientRect();
      const hasQuestionText = parent.querySelector && parent.querySelector(".question-standalone-content-box");
      const isAnswerSized = rect.width > 80 && rect.height >= 28 && rect.height < rootRect.height * 0.6;

      if (!hasQuestionText && isAnswerSized && parent.textContent && parent.textContent.trim().length > 0) {
        const radio = parent.querySelector && parent.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.click();
          return true;
        }
        return dispatchClick(parent);
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function clickByAnswerCoordinates(textRect, rootElement) {
    if (!textRect || textRect.width <= 0 || textRect.height <= 0) return false;

    const y = textRect.top + textRect.height / 2;
    const points = [
      [Math.max(1, textRect.left - 35), y],
      [Math.max(1, textRect.left - 70), y],
      [Math.max(1, textRect.left - 55), y],
      [textRect.left + Math.min(12, textRect.width / 2), y],
      [Math.max(1, textRect.left - 22), y],
      [Math.max(1, textRect.left - 42), y],
      [textRect.right - Math.min(12, textRect.width / 2), y]
    ];

    let clickedAny = false;
    for (const [x, pointY] of points) {
      const target = document.elementFromPoint(x, pointY);
      if (!target || target === document.body || target === document.documentElement) continue;
      if (rootElement && !rootElement.contains(target)) continue;

      const clickableTarget = findClickableAncestor(target, rootElement) || target;
      if (dispatchClickAtPoint(clickableTarget, x, pointY)) clickedAny = true;
    }

    return clickedAny;
  }

  function findClickableAncestor(element, rootElement) {
    let parent = element;
    while (parent && parent !== document.body && parent !== rootElement.parentElement) {
      if (isClickableAnswerElement(parent)) return parent;
      parent = parent.parentElement;
    }
    return null;
  }

  function isClickableAnswerElement(element) {
    if (!element) return false;
    const clickableSelector = [
      "label", "button", '[role="radio"]', '[role="option"]',
      ".item-answer", ".answer-item", ".answer", ".option", ".option-item",
      ".ant-radio-wrapper", ".mat-radio-label"
    ].join(", ");

    if (element.matches && element.matches(clickableSelector)) return true;

    const rect = element.getBoundingClientRect();
    const display = window.getComputedStyle(element).display;
    const isVisibleBlock = rect.width > 20 && rect.height > 15 && element.offsetHeight > 0;
    const isLikelyAnswerBlock = element.children.length <= 3 && element.textContent && element.textContent.trim().length > 0;
    return display !== "inline" && isVisibleBlock && isLikelyAnswerBlock;
  }

  function dispatchClick(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return dispatchClickAtPoint(element, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function dispatchClickAtPoint(element, clientX, clientY) {
    if (!element) return false;
    const eventOptions = { bubbles: true, cancelable: true, view: window, clientX, clientY };

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      const EventConstructor = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      element.dispatchEvent(new EventConstructor(type, eventOptions));
    });

    if (typeof element.click === "function") element.click();
    return true;
  }

  // --------------------------------------------------------------------------
  // 4. QUÉT CÂU HỎI VÀ XỬ LÝ TỰ ĐỘNG
  // --------------------------------------------------------------------------
  async function runFindAnswer(shouldClick, clickAll = false) {
    try {
      if (!answerBank) {
        await fetchAnswerBank();
        if (!answerBank) return;
      }

      if (shouldClick && autoClickInProgress) return;
      if (shouldClick) autoClickInProgress = true;

      const questionContainers = Array.from(document.querySelectorAll(QUESTION_SELECTOR));
      for (let index = 0; index < questionContainers.length; index++) {
        const container = questionContainers[index];
        try {
          const questionElement = container.querySelector(QUESTION_TEXT_SELECTOR);
          if (!questionElement) continue;

          const sanitizedQuestion = sanitizeText(questionElement.innerText);
          if (!sanitizedQuestion) continue;

          const needsHighlight = container.dataset.lastQuestion !== sanitizedQuestion || !hasHighlightForQuestion(sanitizedQuestion);
          if (!shouldClick && !needsHighlight) continue;

          removeHighlightsForQuestion(sanitizedQuestion);

          const answers = findAnswers(sanitizedQuestion);
          if (!answers || answers[0] === ANSWER_NOT_FOUND) {
            if (!shouldClick) container.dataset.lastQuestion = sanitizedQuestion;
            continue;
          }

          const searchRoot = findAnswerSearchRoot(container, answers);
          const correctAnswerIsSelected = shouldClick && isAnswerSelected(answers, searchRoot);
          const needsClick = shouldClick && (!clickedQuestions.has(sanitizedQuestion) || !correctAnswerIsSelected);

          if (shouldClick && !needsClick) continue;

          const clicked = drawHighlightAndClick(
            answers,
            sanitizedQuestion,
            !shouldClick && needsHighlight,
            needsClick,
            searchRoot
          );

          if (shouldClick) {
            if (clicked) {
              clickedQuestions.add(sanitizedQuestion);
              if (!clickAll) break;
            }
            continue;
          }

          container.dataset.lastQuestion = sanitizedQuestion;
        } catch (err) {}
      }
    } catch (err) {
    } finally {
      if (shouldClick) autoClickInProgress = false;
    }
  }

  function startAutoHighlight() {
    if (autoHighlightInterval || autoHighlightObserver || !document.body) return;
    runFindAnswer(false);
    autoHighlightInterval = setInterval(() => runFindAnswer(false), 3000);
    autoHighlightObserver = new MutationObserver(() => {
      if (pendingHighlightTimer) clearTimeout(pendingHighlightTimer);
      pendingHighlightTimer = setTimeout(() => {
        pendingHighlightTimer = null;
        runFindAnswer(false);
      }, 300);
    });
    autoHighlightObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopAutoHighlight() {
    if (autoHighlightInterval) clearInterval(autoHighlightInterval);
    if (autoHighlightObserver) autoHighlightObserver.disconnect();
    if (pendingHighlightTimer) clearTimeout(pendingHighlightTimer);
    autoHighlightInterval = null;
    autoHighlightObserver = null;
    pendingHighlightTimer = null;
  }

  function cleanUp() {
    stopAutoHighlight();
    clickedQuestions.clear();
    document.querySelectorAll(QUESTION_SELECTOR).forEach((c) => delete c.dataset.lastQuestion);
    document.querySelectorAll(".extension-highlight").forEach((el) => {
      resetCornerRadiusMarker(el);
      delete el.dataset.questionId;
      el.classList.remove("extension-highlight");
    });
  }

  // --------------------------------------------------------------------------
  // 5. LẮNG NGHE PHÍM TẮT NGẦM
  // --------------------------------------------------------------------------
  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "x") {
      event.preventDefault();
      runFindAnswer(true, true);
    } else if (key === "c") {
      event.preventDefault();
      runFindAnswer(true, false);
    } else if (key === "n") {
      event.preventDefault();
      if (autoHighlightInterval) stopAutoHighlight();
      else startAutoHighlight();
    }
  }, true);

  // Click 3 lần liên tiếp vào nền để dọn dẹp sạch sẽ
  document.addEventListener("click", (e) => {
    // Bỏ qua click vào các phần tử tương tác (bao gồm contenteditable) để tránh trigger nhầm
    const editableSelector = 'input, textarea, select, button, [contenteditable="true"]';
    if (e.target && e.target.closest && e.target.closest(editableSelector)) return;
    cleanupClickCount++;
    if (cleanupClickTimer) clearTimeout(cleanupClickTimer);
    cleanupClickTimer = setTimeout(() => { cleanupClickCount = 0; cleanupClickTimer = null; }, 700);
    if (cleanupClickCount >= 3) {
      cleanUp();
      cleanupClickCount = 0;
    }
  });

  // --------------------------------------------------------------------------
  // 6. EXPORT CÁC HÀM NGẦM
  // --------------------------------------------------------------------------
  window.solveAll = () => runFindAnswer(true, true);
  window.solveOne = () => runFindAnswer(true, false);
  window.highlightAnswers = () => startAutoHighlight();
  window.cleanUp = () => cleanUp();

  // Tải dữ liệu rồi chỉ bật auto-highlight ngầm (bo góc kín đáo).
  // Muốn tự chọn đáp án: bấm Alt+X hoặc gọi solveAll() trong Console.
  fetchAnswerBank().then(() => {
    startAutoHighlight();
  });
})();
