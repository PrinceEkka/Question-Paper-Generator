// --- Global Data Stores ---
let unitCount = 0;
let questionIdCounter = 0;
let activeUnit = 1;
let allUnitsData = {};
let generatedSets = [];

// --- Theme Management ---
document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

// --- UI Feedback Functions ---
function showMessage(title, message) {
    document.getElementById("overlay").style.display = "block";
    const msgBox = document.getElementById("messageBox");
    msgBox.style.display = "block";
    msgBox.querySelector('.title').textContent = title;
    msgBox.querySelector('.content').textContent = message;
}

function closeMessage() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("messageBox").style.display = "none";
}

function showLoading(show = true) {
    document.getElementById("overlay").style.display = show ? "block" : "none";
    document.getElementById("loadingBox").style.display = show ? "flex" : "none";
}

// --- Step 1: Question Management ---

function parseAndSeparateAnswer(textBlock) {
    const answerRegex = /^(.*?)(Answer:.*)$/si;
    const match = textBlock.trim().match(answerRegex);
    if (match) {
        return {
            questionText: match[1].trim(),
            answerText: match[2].trim()
        };
    }
    return {
        questionText: textBlock.trim(),
        answerText: ''
    };
}

function renderUnit(unitNumber) {
    const unitData = allUnitsData[unitNumber];
    const container = document.getElementById(`unit-question-list-${unitNumber}`);
    if (!container) return;

    let html = '';
    const questionTypes = { mcqs: 'MCQs', vshorts: 'Very Short Answer', shorts: 'Short Answer', longs: 'Long Answer' };

    for (const type in questionTypes) {
        if (!unitData[type]) continue;
        html += `<div class="question-category"><h3>${questionTypes[type]}</h3>`;

        unitData[type].forEach(q => {
            if (q.isOrGroup) {
                let orGroupHtml = `<div class="or-group-wrapper" data-group-id="${q.id}">
                                     <div class="or-group-main">
                                         <input type="checkbox" class="question-select-checkbox" data-question-id="${q.id}" data-unit="${q.unit}" data-type="${q.type}" data-is-group="true">
                                         <div class="or-group-content">`;
                orGroupHtml += q.questions.map(subQ => {
                    const fullTextForTextarea = subQ.answer ? `${subQ.text}\n${subQ.answer}` : subQ.text;
                    return `<div class="question-item-wrapper" data-question-id="${subQ.id}">
                                <div class="question-block">
                                    <textarea class="question-textarea" oninput="updateQuestionText(this, ${subQ.id})" onblur="renderUnit(${q.unit})" placeholder="Enter question...">${fullTextForTextarea}</textarea>
                                </div>
                            </div>`;
                }).join('<div class="or-separator">OR</div>');
                orGroupHtml += `</div></div>
                                 <div class="or-group-actions">
                                     <button class="secondary-btn" onclick="ungroupOrQuestions(${q.unit}, ${q.id}, '${q.type}')">Ungroup</button>
                                     <button class="remove-q-btn" onclick="removeQuestion(${q.unit}, ${q.id}, '${q.type}')">&times;</button>
                                 </div></div>`;
                html += orGroupHtml;
            } else {
                const fullTextForTextarea = q.answer ? `${q.text}\n${q.answer}` : q.text;
                html += `
                    <div class="question-item-wrapper" data-question-id="${q.id}">
                        <div class="question-block">
                            <input type="checkbox" class="question-select-checkbox" data-question-id="${q.id}" data-unit="${unitNumber}" data-type="${type}">
                            <textarea class="question-textarea" oninput="updateQuestionText(this, ${q.id})" onblur="renderUnit(${unitNumber})" onpaste="handlePaste(event, ${unitNumber}, ${q.id}, '${type}')" placeholder="Enter your question text here...">${fullTextForTextarea}</textarea>
                            <button class="remove-q-btn" onclick="removeQuestion(${unitNumber}, ${q.id}, '${type}')">&times;</button>
                        </div>
                    </div>`;
            }
        });
        html += `<button class="add-q-btn" onclick="addQuestion(${unitNumber}, '${type}')">+ Add ${questionTypes[type]}</button></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll('textarea').forEach(autoResize);
}

function handlePaste(event, unitNumber, targetQuestionId, type) {
    event.preventDefault();
    const pasteData = (event.clipboardData || window.clipboardData).getData('text');
    const questionBlocks = pasteData.trim().split(/\n\s*\n/);
    if (questionBlocks.length === 0) return;

    const currentQuestion = findQuestionById(targetQuestionId);
    if (currentQuestion) {
        const { questionText, answerText } = parseAndSeparateAnswer(questionBlocks[0]);
        currentQuestion.text = questionText;
        currentQuestion.answer = answerText;
    }

    questionBlocks.slice(1).forEach(block => addQuestion(unitNumber, type, block));
    renderUnit(unitNumber);
}

function updateQuestionText(textarea, questionId) {
    const question = findQuestionById(questionId);
    if (question) {
        const { questionText, answerText } = parseAndSeparateAnswer(textarea.value);
        question.text = questionText;
        question.answer = answerText;
    }
    autoResize(textarea);
}

function addQuestion(unitNumber, type, fullText = '') {
    questionIdCounter++;
    const { questionText, answerText } = parseAndSeparateAnswer(fullText);
    const newQuestion = {
        id: questionIdCounter,
        text: questionText,
        answer: answerText,
        isOrGroup: false,
        unit: unitNumber,
        type: type
    };

    if (!allUnitsData[unitNumber][type]) allUnitsData[unitNumber][type] = [];
    allUnitsData[unitNumber][type].push(newQuestion);
    renderUnit(unitNumber);
}

function removeQuestion(unitNumber, questionId, type) {
    allUnitsData[unitNumber][type] = allUnitsData[unitNumber][type].filter(q => q.id !== questionId);
    renderUnit(unitNumber);
}

function groupOrQuestions() {
    const selectedCheckboxes = document.querySelectorAll('.question-select-checkbox:checked');
    if (selectedCheckboxes.length < 2) {
        return showMessage('Selection Error', 'Please select at least two questions to group.');
    }

    const firstCheckbox = selectedCheckboxes[0];
    const unitNumber = firstCheckbox.dataset.unit;
    const questionType = firstCheckbox.dataset.type;

    for (const checkbox of selectedCheckboxes) {
        if (checkbox.dataset.unit !== unitNumber || checkbox.dataset.type !== questionType || checkbox.dataset.isGroup === 'true') {
            return showMessage('Grouping Error', 'All selected questions must be from the same unit, of the same type, and not already in a group.');
        }
    }

    const questionIdsToGroup = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.questionId));
    const typeArray = allUnitsData[unitNumber][questionType];
    
    const questionsToGroup = [];
    const remainingQuestions = typeArray.filter(q => {
        if (questionIdsToGroup.includes(q.id)) {
            questionsToGroup.push(q);
            return false;
        }
        return true;
    });

    if (questionsToGroup.length > 0) {
        questionIdCounter++;
        const newGroup = {
            id: questionIdCounter,
            isOrGroup: true,
            questions: questionsToGroup,
            unit: parseInt(unitNumber),
            type: questionType
        };
        allUnitsData[unitNumber][questionType] = [...remainingQuestions, newGroup];
        renderUnit(unitNumber);
    }
}

function ungroupOrQuestions(unitNumber, groupId, type) {
    const typeArray = allUnitsData[unitNumber][type];
    const groupToUngroup = typeArray.find(q => q.id === groupId && q.isOrGroup);
    if (!groupToUngroup) return;

    const ungroupedQuestions = groupToUngroup.questions;
    const newTypeArray = typeArray.filter(q => q.id !== groupId);
    allUnitsData[unitNumber][type] = [...newTypeArray, ...ungroupedQuestions];
    renderUnit(unitNumber);
}


function findQuestionById(id) {
    for (const unitNum in allUnitsData) {
        for (const type in allUnitsData[unitNum]) {
            const items = allUnitsData[unitNum][type];
            if (!Array.isArray(items)) continue;
            for (const item of items) {
                if (item.isOrGroup) {
                    const foundSubQuestion = item.questions.find(subQ => subQ.id === id);
                    if (foundSubQuestion) return foundSubQuestion;
                } else if (item.id === id) {
                    return item;
                }
            }
        }
    }
    return null;
}


function addUnit() {
    unitCount++;
    allUnitsData[unitCount] = { mcqs: [], vshorts: [], shorts: [], longs: [] };
    document.getElementById('unit-list').innerHTML += `<li><button class="unit-btn" id="unit-btn-${unitCount}" onclick="showUnit(${unitCount})">Unit ${unitCount}</button></li>`;
    
    const areasContainer = document.getElementById('question-areas-container');
    const newAreaWrapper = document.createElement('div');
    newAreaWrapper.className = 'unit-content-wrapper';
    newAreaWrapper.id = `unit-content-wrapper-${unitCount}`;
    newAreaWrapper.innerHTML = `<div class="unit-question-list" id="unit-question-list-${unitCount}"></div>`;
    areasContainer.appendChild(newAreaWrapper);
    
    showUnit(unitCount);
    addQuestion(unitCount, 'mcqs');
}

function showUnit(unitNumber) {
    activeUnit = unitNumber;
    document.querySelectorAll('.unit-content-wrapper').forEach(w => w.style.display = 'none');
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`unit-content-wrapper-${unitNumber}`).style.display = 'flex';
    document.getElementById(`unit-btn-${unitNumber}`).classList.add('active');
    renderUnit(unitNumber);
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// --- Step 2: Configuration and Generation ---

function moveToStep2() {
    document.getElementById('step1').style.display = 'none';
    const step2Container = document.getElementById('step2');
    step2Container.style.display = 'block';
    step2Container.innerHTML = `
        <div class="dashboard-grid">
            <div class="config-box">
                <h3>Question Bank Summary</h3>
                <div id="bankSummary"></div>
            </div>
            <div class="config-box">
                <h3>Paper Details</h3>
                <form id="paperDetailsForm" onsubmit="return false;">
                    <div class="form-row">
                        <div class="form-group"><label for="examName">Exam Name:</label><input type="text" id="examName" placeholder="e.g., Mid-Term Examination" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="className">Class:</label><input type="text" id="className" placeholder="e.g., B.Tech CSE I Year" required></div>
                        <div class="form-group"><label for="year">Year:</label><input type="text" id="year" placeholder="e.g., II" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="subject">Subject:</label><input type="text" id="subject" placeholder="e.g., Computer Science" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="maxMarks">Max Marks:</label><input type="number" id="maxMarks" placeholder="75" required readonly><small><i>(Auto-Calculated)</i></small></div>
                        <div class="form-group"><label for="timeAllowed">Time Allowed:</label><input type="text" id="timeAllowed" placeholder="e.g., 3 Hours" required></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="examDate">Exam Date:</label><input type="date" id="examDate" required></div>
                    </div>
                </form>
            </div>
        </div>
        <div class="config-box">
            <h3>Set Generation Rules</h3>
            <form id="setGenerationForm" onsubmit="return false;" class="set-gen-form">
                <div class="form-group sets-group"><label for="numSets">Number of Sets:</label><input type="number" id="numSets" value="2" min="1"></div><hr>
                ${createSectionRulesHTML('mcq', 'MCQs', 5, 1)}
                ${createSectionRulesHTML('vshort', 'Very Short', 5, 2)}
                ${createSectionRulesHTML('short', 'Short Answer', 4, 5)}
                ${createSectionRulesHTML('long', 'Long Answer', 3, 10)}
                <hr>
                <div class="form-group" style="padding-left: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="generateAnswerKey" checked style="width: auto;">
                    <label for="generateAnswerKey" style="margin: 0;">Generate answer key</label>
                </div>
            </form>
            <button class="primary-btn" onclick="generateAndDisplaySets()">Generate Sets & Preview</button>
        </div>
        <div id="previewArea" class="config-box" style="display:none;">
            <h3>Generated Sets Preview</h3>
            <div id="set-tabs"></div>
            <div id="set-content"></div>
            <div id="download-actions" style="margin-top: 20px; display: flex; gap: 10px;">
                <button id="downloadQpBtn" class="primary-btn">Download Question Paper</button>
                <button id="downloadKeyBtn" class="secondary-btn">Download Answer Key</button>
            </div>
        </div>
    `;
    updateBankSummary();
    calculateTotalMarks();
    document.getElementById('downloadQpBtn').addEventListener('click', () => downloadPDF('questionPaper'));
    document.getElementById('downloadKeyBtn').addEventListener('click', () => downloadPDF('answerKey'));
}

function createSectionRulesHTML(prefix, title, numQ, marks) {
    return `
        <div class="section-rules">
            <h4>${title}</h4>
            <div class="form-group"><label for="num${prefix.toUpperCase()}">Questions to Generate:</label><input type="number" id="num${prefix.toUpperCase()}" value="${numQ}" min="0" oninput="syncAttemptCount('${prefix}'); calculateTotalMarks();"></div>
            <div class="form-group"><label for="${prefix}Marks">Marks per question:</label><input type="number" id="${prefix}Marks" value="${marks}" min="0" oninput="calculateTotalMarks()"></div>
            <div class="form-group"><label for="${prefix}NoteType">Section Note:</label>
                <select id="${prefix}NoteType" onchange="handleNoteTypeChange('${prefix}')">
                    <option value="compulsory" selected>All questions compulsory</option>
                    <option value="attempt">Attempt any ___</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            <div class="form-group" id="${prefix}AttemptNoteGroup" style="display:none;"><label for="${prefix}AttemptCount">Questions to Attempt:</label><input type="number" id="${prefix}AttemptCount" value="${numQ}" min="0" oninput="calculateTotalMarks()"></div>
            <div class="form-group" id="${prefix}CustomNoteGroup" style="display:none;"><label for="${prefix}CustomNote">Custom Note:</label><input type="text" id="${prefix}CustomNote" placeholder="Enter custom note..."></div>
        </div>`;
}

function updateBankSummary() {
    const summary = { mcqs: 0, vshorts: 0, shorts: 0, longs: 0, units: new Set() };
    Object.keys(allUnitsData).forEach(unitNum => {
        summary.units.add(unitNum);
        Object.keys(allUnitsData[unitNum]).forEach(type => {
            summary[type] += allUnitsData[unitNum][type].length;
        });
    });
    document.getElementById('bankSummary').innerHTML = `
        <p>Total Units: <strong>${summary.units.size}</strong></p>
        <p>Total MCQs: <strong>${summary.mcqs}</strong></p>
        <p>Total Very Short: <strong>${summary.vshorts}</strong></p>
        <p>Total Short Answer: <strong>${summary.shorts}</strong></p>
        <p>Total Long Answer: <strong>${summary.longs}</strong></p>`;
}

function syncAttemptCount(prefix) {
    const generateInput = document.getElementById(`num${prefix.toUpperCase()}`);
    const attemptInput = document.getElementById(`${prefix}AttemptCount`);
    if (generateInput && attemptInput) attemptInput.value = generateInput.value;
}

function handleNoteTypeChange(prefix) {
    const noteType = document.getElementById(`${prefix}NoteType`).value;
    document.getElementById(`${prefix}AttemptNoteGroup`).style.display = (noteType === 'attempt') ? 'block' : 'none';
    document.getElementById(`${prefix}CustomNoteGroup`).style.display = (noteType === 'custom') ? 'block' : 'none';
    calculateTotalMarks();
}

function calculateTotalMarks() {
    let totalMarks = 0;
    const sections = ['mcq', 'vshort', 'short', 'long'];
    sections.forEach(prefix => {
        const noteType = document.getElementById(`${prefix}NoteType`).value;
        const marksPerQ = parseInt(document.getElementById(`${prefix}Marks`).value) || 0;
        let questionCount = 0;
        if (noteType === 'attempt') {
            questionCount = parseInt(document.getElementById(`${prefix}AttemptCount`).value) || 0;
        } else {
            const inputId = `num${prefix.toUpperCase()}`;
            if (document.getElementById(inputId)) {
                questionCount = parseInt(document.getElementById(inputId).value) || 0;
            }
        }
        totalMarks += questionCount * marksPerQ;
    });
    document.getElementById('maxMarks').value = totalMarks;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function selectFairly(questionsOfType, numToSelect, numSets) {
    let finalSets = Array.from({ length: numSets }, () => []);
    const orGroups = questionsOfType.filter(q => q.isOrGroup);
    const regularQuestions = questionsOfType.filter(q => !q.isOrGroup);

    shuffleArray(orGroups);
    let orGroupCounter = 0;
    if (orGroups.length > 0) {
        for (let i = 0; i < numSets * numToSelect; i++) {
            const setIndex = i % numSets;
            if (finalSets[setIndex].length < numToSelect && orGroupCounter < orGroups.length) {
                finalSets[setIndex].push(orGroups[orGroupCounter++]);
            }
        }
    }

    const questionsByUnit = regularQuestions.reduce((acc, q) => {
        const unit = q.unit || 'Uncategorized';
        if (!acc[unit]) acc[unit] = [];
        acc[unit].push(q);
        return acc;
    }, {});
    Object.values(questionsByUnit).forEach(shuffleArray);
    const unitKeys = Object.keys(questionsByUnit);
    shuffleArray(unitKeys);
    let currentUnitIndex = 0;

    for (let setIndex = 0; setIndex < numSets; setIndex++) {
        while (finalSets[setIndex].length < numToSelect) {
            let questionFound = false;
            for (let i = 0; i < unitKeys.length; i++) {
                const unitName = unitKeys[currentUnitIndex];
                if (questionsByUnit[unitName]?.length > 0) {
                    finalSets[setIndex].push(questionsByUnit[unitName].pop());
                    questionFound = true;
                    break;
                }
                currentUnitIndex = (currentUnitIndex + 1) % unitKeys.length;
            }
            if (!questionFound) break;
        }
    }

    finalSets.forEach(shuffleArray);
    return finalSets;
}


function generateAndDisplaySets() {
    const numSets = parseInt(document.getElementById("numSets").value);
    const questionPool = { mcqs: [], vshorts: [], shorts: [], longs: [] };
    
    Object.values(allUnitsData).forEach(unit => {
        Object.keys(questionPool).forEach(type => {
            if (unit[type]) {
                questionPool[type].push(...unit[type]);
            }
        });
    });

    generatedSets = [];
    let insufficientWarning = false;

    for (let i = 0; i < numSets; i++) {
        const set = { label: String.fromCharCode(65 + i), mcqs: [], vshorts: [], shorts: [], longs: [] };
        ['mcqs', 'vshorts', 'shorts', 'longs'].forEach(type => {
            const numToSelect = parseInt(document.getElementById(`num${type.slice(0, -1).toUpperCase()}`).value);
            if(questionPool[type].length < numToSelect){
                insufficientWarning = true;
            }
            const selected = selectFairly(questionPool[type], numToSelect, 1)[0] || [];
            set[type] = selected;
        });
        generatedSets.push(set);
    }
    
    if (insufficientWarning) {
        showMessage("Warning", "Not enough unique questions available for one or more sections. Some sets may be incomplete.");
    }

    displayGeneratedSets();
    document.getElementById('previewArea').style.display = 'block';
}

function displayGeneratedSets() {
    const tabsContainer = document.getElementById('set-tabs');
    const contentContainer = document.getElementById('set-content');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    generatedSets.forEach((set, index) => {
        tabsContainer.innerHTML += `<button class="tab-btn ${index === 0 ? 'active' : ''}" onclick="showSet(event, '${set.label}')">Set ${set.label}</button>`;
        let contentHtml = `<div id="set-content-${set.label}" class="tab-content ${index === 0 ? 'active' : ''}">`;

        const renderSection = (title, questions) => {
            if (!questions || questions.length === 0) return '';
            let sectionHtml = `<h4>${title}</h4><ol>`;
            questions.forEach(q => {
                if (q.isOrGroup) {
                    sectionHtml += `<li>${q.questions.map(m => m.text.replace(/\n/g, '<br>')).join(' <strong style="color: var(--or-group-border);">OR</strong> ')}</li>`;
                } else {
                    sectionHtml += `<li>${q.text.replace(/\n/g, '<br>')}</li>`;
                }
            });
            return sectionHtml + `</ol>`;
        };

        contentHtml += renderSection("MCQs", set.mcqs);
        contentHtml += renderSection("Very Short Answer", set.vshorts);
        contentHtml += renderSection("Short Answer", set.shorts);
        contentHtml += renderSection("Long Answer", set.longs);
        contentHtml += '</div>';
        contentContainer.innerHTML += contentHtml;
    });
}

function showSet(event, setName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`set-content-${setName}`).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- PDF Generation Logic ---
async function downloadPDF(fileType) {
    const headerForm = document.getElementById('paperDetailsForm');
    if (!headerForm.checkValidity()) {
        return showMessage("Missing Details", "Please fill in all fields under 'Paper Details'.");
    }
    showLoading();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Prepare data
    const paperDetails = {
        examName: document.getElementById('examName').value,
        className: document.getElementById('className').value,
        year: document.getElementById('year').value,
        subject: document.getElementById('subject').value,
        maxMarks: document.getElementById('maxMarks').value,
        timeAllowed: document.getElementById('timeAllowed').value,
        examDate: new Date(document.getElementById('examDate').value).toLocaleDateString('en-GB'),
    };

    for (const set of generatedSets) {
        doc.setFontSize(20).setFont(undefined, 'bold').text("St. Paul Institute of Professional Studies, Indore", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        doc.setFontSize(12).setFont(undefined, 'normal').text("An Autonomous Institute Affiliated to Devi Ahilya Vishwavidyalaya, Indore", doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
        doc.setFontSize(12).text("Accredited by NAAC with 'A' Grade", doc.internal.pageSize.getWidth() / 2, 36, { align: 'center' });

        doc.setFontSize(14).setFont(undefined, 'bold').text(`${paperDetails.examName} - SET ${set.label}`, doc.internal.pageSize.getWidth() / 2, 48, { align: 'center' });
        
        let y = 60;
        doc.setFontSize(11).setFont(undefined, 'bold');
        doc.text(`Subject: ${paperDetails.subject}`, 14, y);
        doc.text(`Max. Marks: ${paperDetails.maxMarks}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
        y += 7;
        doc.text(`Class: ${paperDetails.className}`, 14, y);
        doc.text(`Time Allowed: ${paperDetails.timeAllowed}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
        y += 7;
        doc.text(`Date: ${paperDetails.examDate}`, 14, y);
        y += 10;
        
        doc.setLineWidth(0.5);
        doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
        y += 10;
        
        doc.setFontSize(10).setFont(undefined, 'bold').text("Note:", 14, y);
        doc.setFont(undefined, 'normal').text("The blind students will be given 60 minutes extra time. The college has all rights to change the distribution of marks.", 24, y);
        y += 15;

        // Render sections
        y = renderPdfSection(doc, 'Section A (Objective Questions)', set.mcqs, y, fileType, 'mcq');
        y = renderPdfSection(doc, 'Section B (Very Short Answer Questions)', set.vshorts, y, fileType, 'vshort');
        y = renderPdfSection(doc, 'Section C (Short Answer Questions)', set.shorts, y, fileType, 'short');
        y = renderPdfSection(doc, 'Section D (Long Answer Questions)', set.longs, y, fileType, 'long');

        if (generatedSets.indexOf(set) < generatedSets.length - 1) {
            doc.addPage();
        }
    }
    
    doc.save(`${paperDetails.subject}_${fileType}.pdf`);
    showLoading(false);
}

function renderPdfSection(doc, title, questions, y, fileType, typePrefix) {
    if (!questions || questions.length === 0) return y;

    const noteType = document.getElementById(`${typePrefix}NoteType`).value;
    const toAttempt = document.getElementById(`${typePrefix}AttemptCount`).value;
    const totalQuestions = document.getElementById(`num${typePrefix.toUpperCase()}`).value;
    const marksPerQ = document.getElementById(`${typePrefix}Marks`).value;
    let note = "All questions are compulsory.";
    if(noteType === 'attempt') note = `Attempt any ${toAttempt} questions.`;
    if(noteType === 'custom') note = document.getElementById(`${typePrefix}CustomNote`).value;


    doc.setFontSize(14).setFont(undefined, 'bold').text(title, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10).setFont(undefined, 'bold').text(`(${toAttempt} x ${marksPerQ} = ${toAttempt * marksPerQ} Marks)`, doc.internal.pageSize.getWidth() -14, y - 8, {align: 'right'});
    doc.setFontSize(10).setFont(undefined, 'bold').text(note, 14, y);
    y += 10;
    
    doc.setFontSize(12).setFont(undefined, 'normal');
    questions.forEach((q, index) => {
        let questionText;
        if (q.isOrGroup) {
            questionText = q.questions.map(subQ => subQ.text).join('\nOR\n');
        } else {
            questionText = q.text;
        }

        const splitText = doc.splitTextToSize(`Q${index + 1}. ${questionText}`, doc.internal.pageSize.getWidth() - 38);
        if (y + (splitText.length * 7) > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
        }
        doc.text(splitText, 14, y);
        y += (splitText.length * 7) + 5;

        if (fileType === 'answerKey' && q.answer) {
            doc.setFont(undefined, 'italic').setTextColor(100);
            const answerText = doc.splitTextToSize(`Answer: ${q.answer}`, doc.internal.pageSize.getWidth() - 48);
             if (y + (answerText.length * 7) > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 20;
            }
            doc.text(answerText, 24, y);
            y += (answerText.length * 7) + 5;
            doc.setFont(undefined, 'normal').setTextColor(0);
        }
    });
    return y + 10;
}



// --- Initial Load ---
window.onload = () => {
    loadTheme();
    addUnit();
};