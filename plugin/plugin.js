(function(window, undefined) {

	// Cache UI selectors
	const tabPrompt = document.getElementById('tab-prompt');
	const tabStructure = document.getElementById('tab-structure');
	const tabConsole = document.getElementById('tab-console');
	const tabSettings = document.getElementById('tab-settings');
	
	const viewPrompt = document.getElementById('view-prompt');
	const viewStructure = document.getElementById('view-structure');
	const viewConsole = document.getElementById('view-console');
	const viewSettings = document.getElementById('view-settings');
	
	const structureJson = document.getElementById('structure-json');
	const copyStructure = document.getElementById('copy-structure');
	const refreshStructure = document.getElementById('refresh-structure');

	const apiKeyInput = document.getElementById('api-key');
	const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
	const saveKeyBtn = document.getElementById('save-key-btn');
	const removeKeyBtn = document.getElementById('remove-key-btn');

	const modelSelect = document.getElementById('model-select');
	const providerSelect = document.getElementById('provider-select');
	const apiUrlInput = document.getElementById('api-url');
	const modelInput = document.getElementById('model-input');
	const urlConfigGroup = document.getElementById('url-config-group');
	const keyConfigGroup = document.getElementById('key-config-group');
	const modelSelectGroup = document.getElementById('model-select-group');
	const modelInputGroup = document.getElementById('model-input-group');
	const loadModelsBtn = document.getElementById('load-models-btn');
	const localModelSelectGroup = document.getElementById('local-model-select-group');
	const localModelSelect = document.getElementById('local-model-select');
	const toggleManualModel = document.getElementById('toggle-manual-model');
	const toggleDropdownModel = document.getElementById('toggle-dropdown-model');
	const modelCostBadge = document.getElementById('model-cost-badge');
	const promptInput = document.getElementById('prompt-input');
	const executeBtn = document.getElementById('execute-btn');
	const logContainer = document.getElementById('log-container');
	const clearLogsBtn = document.getElementById('clear-logs');
	const resetLogsBtn = document.getElementById('reset-logs');
	
	const chatHistoryContainer = document.getElementById('chat-history');
	const undoAiBtn = document.getElementById('undo-ai-btn');
	const contextToolbar = document.getElementById('context-toolbar');
	let appliedChangesCount = 0;
	let currentChatProposal = null;
	let isInternalQuery = false;
	let lastInternalQueryTime = 0;

	// Undo / Redo selectors
	const toolbarUndo = document.getElementById('toolbar-undo');
	const toolbarRedo = document.getElementById('toolbar-redo');

	// Persistent Log File
	const logStorageKey = "onescript_log_file";
	let logLines = [];

	// Summarization elements
	let activeSummaryContent = '';

	// Session Checkpoints elements
	const saveCheckpointBtn = document.getElementById('save-checkpoint-btn');
	const checkpointsList = document.getElementById('checkpoints-list');

	// New Redesigned UI Selectors
	const toggleViewOutline = document.getElementById('toggle-view-outline');
	const toggleViewJson = document.getElementById('toggle-view-json');
	const outlineTreeContainer = document.getElementById('outline-tree-container');

	const btnTabLogs = document.getElementById('btn-tab-logs');
	const btnTabTelemetry = document.getElementById('btn-tab-telemetry');
	const paneLogs = document.getElementById('pane-logs');
	const paneTelemetry = document.getElementById('pane-telemetry');

	const slashMenu = document.getElementById('slash-menu');
	const promptScopeBadge = document.getElementById('prompt-scope-badge');

	let activeAiMessageBody = null;
	let currentAgentSteps = null;

	let cachedDocData = null;
	let proposedChanges = null;
	let checkpoints = [];

	// Chat rendering helper
	function appendChatMessage(sender, content, type = 'text') {
		const welcome = chatHistoryContainer.querySelector('.chat-welcome');
		if (welcome) {
			welcome.style.display = 'none';
		}

		const messageDiv = document.createElement('div');
		messageDiv.className = `chat-message ${sender}`;
		
		const header = document.createElement('div');
		header.className = 'message-header';
		header.innerText = sender === 'user' ? 'You' : 'OneScript';
		
		const body = document.createElement('div');
		body.className = 'message-body';
		
		if (type === 'html') {
			body.innerHTML = content;
		} else {
			body.textContent = content;
		}
		
		messageDiv.appendChild(header);
		messageDiv.appendChild(body);
		chatHistoryContainer.appendChild(messageDiv);
		
		chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
		return messageDiv;
	}

	// Helper to perform multiple undo operations sequentially
	function performMultipleUndos(n, callback) {
		if (n <= 0) {
			if (callback) callback();
			return;
		}
		window.Asc.plugin.executeMethod("Undo", [], () => {
			performMultipleUndos(n - 1, callback);
		});
	}

	// Render Proposed Changes Inline
	function renderChatPreview(aiMessageBody, changes, applied = false) {
		let previewContainer = aiMessageBody.querySelector('.chat-preview-container');
		if (!previewContainer) {
			previewContainer = document.createElement('div');
			previewContainer.className = 'chat-preview-container';
			aiMessageBody.appendChild(previewContainer);
		} else {
			previewContainer.innerHTML = '';
		}
		
		const wrapper = document.createElement('div');
		wrapper.style.display = 'flex';
		wrapper.style.flexDirection = 'column';
		wrapper.style.gap = '8px';
		wrapper.style.marginTop = '6px';
		
		const title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.color = 'var(--primary)';
		title.style.fontSize = '11px';
		title.innerText = applied ? 'Applied Changes Summary:' : 'Proposed Changes Preview:';
		wrapper.appendChild(title);
		
		const changesListDiv = document.createElement('div');
		changesListDiv.style.maxHeight = '110px';
		changesListDiv.style.overflowY = 'auto';
		changesListDiv.style.display = 'flex';
		changesListDiv.style.flexDirection = 'column';
		changesListDiv.style.gap = '6px';
		changesListDiv.style.padding = '8px 10px';
		changesListDiv.style.background = 'var(--bg-sidebar)';
		changesListDiv.style.border = '1px solid rgba(0, 0, 0, 0.06)';
		changesListDiv.style.borderRadius = '6px';
		
		changes.forEach((change) => {
			const original = findElementByIndex(change.targetIndex);
			const isCreation = change.action === 'createParagraph' || change.action === 'create_paragraph' || change.action === 'pasteHTML' || change.action === 'paste_html';
			if (!original && !isCreation) return;
			
			const item = document.createElement('div');
			item.style.padding = '0 0 8px 0';
			item.style.background = 'transparent';
			item.style.border = 'none';
			item.style.borderRadius = '0';
			item.style.fontSize = '10px';
			if (changes.indexOf(change) < changes.length - 1) {
				item.style.borderBottom = '1px solid rgba(0, 0, 0, 0.05)';
			}
			
			let actionBadge = '';
			if (change.action === 'createParagraph' || change.action === 'create_paragraph') {
				actionBadge = '<span class="badge-action action-create" style="font-size: 8px;">Create</span>';
			} else if (change.action === 'deleteParagraph' || change.action === 'delete_paragraph') {
				actionBadge = '<span class="badge-action action-delete" style="font-size: 8px;">Delete</span>';
			} else if (change.action === 'pasteHTML' || change.action === 'paste_html') {
				actionBadge = '<span class="badge-action action-generate" style="font-size: 8px; background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3);">Generate</span>';
			} else {
				actionBadge = '<span class="badge-action action-modify" style="font-size: 8px;">Modify</span>';
			}
			
			let formatStr = '';
			const props = change.properties || {};
			if (props.fontName) formatStr += `Font: ${props.fontName}; `;
			if (props.fontSize) formatStr += `Size: ${props.fontSize/2}pt; `;
			if (props.bold !== undefined) formatStr += props.bold ? 'Bold; ' : 'Regular; ';
			if (props.italic !== undefined) formatStr += props.italic ? 'Italic; ' : 'No Italic; ';
			if (props.alignment !== undefined) formatStr += `Align: ${props.alignment}; `;
			
			const originalText = original ? (original.text || `[Table Element at #${change.targetIndex}]`) : '';
			
			let diffHTML = '';
			if (change.action === 'deleteParagraph' || change.action === 'delete_paragraph') {
				diffHTML = `<div class="diff-original" style="font-size: 9.5px; color: var(--error); text-decoration: line-through;">- "${originalText.substring(0, 50)}${originalText.length > 50 ? '...' : ''}"</div>`;
			} else if (change.action === 'createParagraph' || change.action === 'create_paragraph') {
				diffHTML = `<div class="diff-new" style="font-size: 9.5px; color: var(--success);">+ "${(props.newText || '').substring(0, 50)}"</div>`;
			} else if (change.action === 'pasteHTML' || change.action === 'paste_html') {
				diffHTML = `<div class="diff-new" style="font-size: 9.5px; color: #8b5cf6;">✨ Generated Content</div>`;
			} else {
				if (props.newText !== undefined && props.newText !== originalText) {
					diffHTML = `
						<div class="diff-original" style="font-size: 9.5px; color: var(--error); text-decoration: line-through;">- "${originalText.substring(0, 40)}"</div>
						<div class="diff-new" style="font-size: 9.5px; color: var(--success);">+ "${props.newText.substring(0, 40)}"</div>
					`;
				} else if (originalText) {
					diffHTML = `<div style="font-size: 9.5px; color: var(--text-secondary); font-style: italic;">"${originalText.substring(0, 50)}..."</div>`;
				}
			}
			
			item.innerHTML = `
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
					<span style="font-weight: bold;">Element #${change.targetIndex + 1}</span>
					${actionBadge}
				</div>
				${diffHTML}
				${formatStr ? `<div style="font-size: 9px; color: var(--primary); margin-top: 2px;">Styles: ${formatStr}</div>` : ''}
			`;
			changesListDiv.appendChild(item);
		});
		
		wrapper.appendChild(changesListDiv);
		
		previewContainer.appendChild(wrapper);
		
		if (applied) {
			const revertBtn = document.createElement('button');
			revertBtn.className = 'btn btn-outline btn-danger';
			revertBtn.style.marginTop = '8px';
			revertBtn.style.fontSize = '10px';
			revertBtn.style.padding = '6px 12px';
			revertBtn.style.display = 'inline-flex';
			revertBtn.style.alignItems = 'center';
			revertBtn.style.gap = '4px';
			revertBtn.style.alignSelf = 'flex-start';
			revertBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg> Revert Changes`;
			
			wrapper.appendChild(revertBtn);
			
			return new Promise((resolve) => {
				revertBtn.addEventListener('click', () => {
					revertBtn.disabled = true;
					revertBtn.innerHTML = 'Reverting...';
					log(`Undoing edits for this prompt...`, 'info');
					performMultipleUndos(changes.length, () => {
						revertBtn.innerHTML = '✓ Reverted';
						revertBtn.className = 'btn';
						revertBtn.style.background = '#f3f4f6';
						revertBtn.style.color = '#9ca3af';
						revertBtn.style.border = '1px solid #e5e7eb';
						
						const msg = document.createElement('div');
						msg.style.color = 'var(--error)';
						msg.style.fontWeight = '600';
						msg.style.fontSize = '10.5px';
						msg.style.marginTop = '4px';
						msg.innerText = '✗ Changes discarded & reverted.';
						wrapper.appendChild(msg);
						
						log('Changes successfully reverted.', 'success');
						debouncedRefresh();
						resolve('discard');
					});
				});
			});
		} else {
			const btnGroup = document.createElement('div');
			btnGroup.style.display = 'flex';
			btnGroup.style.gap = '6px';
			btnGroup.style.marginTop = '6px';
			
			const acceptBtn = document.createElement('button');
			acceptBtn.className = 'btn';
			acceptBtn.innerText = 'Accept & Apply';
			acceptBtn.style.flex = '1.2';
			acceptBtn.style.fontSize = '10px';
			acceptBtn.style.padding = '6px';
			acceptBtn.style.background = 'var(--success)';
			
			const discardBtn = document.createElement('button');
			discardBtn.className = 'btn btn-outline btn-danger';
			discardBtn.innerText = 'Discard';
			discardBtn.style.flex = '0.8';
			discardBtn.style.fontSize = '10px';
			discardBtn.style.padding = '6px';
			
			btnGroup.appendChild(acceptBtn);
			btnGroup.appendChild(discardBtn);
			wrapper.appendChild(btnGroup);
			
			return new Promise((resolve) => {
				acceptBtn.addEventListener('click', () => {
					acceptBtn.disabled = true;
					discardBtn.disabled = true;
					acceptBtn.innerText = 'Applying...';
					resolve('accept');
				});
				
				discardBtn.addEventListener('click', () => {
					acceptBtn.disabled = true;
					discardBtn.disabled = true;
					wrapper.innerHTML = '<div style="color: var(--text-muted); font-style: italic; margin-top: 4px;">Proposed changes discarded.</div>';
					resolve('discard');
				});
			});
		}
	}

	// Render Executive Summary Inline
	function renderSummaryInMessage(aiMessageBody, summaryContent) {
		aiMessageBody.innerHTML = '';
		
		const wrapper = document.createElement('div');
		wrapper.style.display = 'flex';
		wrapper.style.flexDirection = 'column';
		wrapper.style.gap = '8px';
		wrapper.style.marginTop = '6px';
		
		const title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.color = 'var(--primary)';
		title.style.fontSize = '11px';
		title.innerText = 'AI Executive Summary:';
		wrapper.appendChild(title);
		
		const textDiv = document.createElement('div');
		textDiv.style.fontSize = '11px';
		textDiv.style.lineHeight = '1.5';
		textDiv.innerText = summaryContent;
		wrapper.appendChild(textDiv);
		
		const insertBtn = document.createElement('button');
		insertBtn.className = 'btn';
		insertBtn.innerText = 'Insert Summary at Cursor';
		insertBtn.style.fontSize = '10px';
		insertBtn.style.padding = '6px';
		insertBtn.style.background = 'var(--info)';
		
		wrapper.appendChild(insertBtn);
		aiMessageBody.appendChild(wrapper);
		
		insertBtn.addEventListener('click', () => {
			insertBtn.disabled = true;
			insertBtn.innerText = 'Inserting...';
			
			window.Asc.scope.summaryText = "\n\n" + summaryContent + "\n\n";
			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var oParagraph = Api.CreateParagraph();
				oParagraph.AddText(Asc.scope.summaryText);
				oDocument.InsertContent([oParagraph]);
				return "success";
			}, false, true, function(res) {
				insertBtn.innerText = 'Inserted ✓';
				log("Summary successfully inserted into document!", "success");
			});
		});
	}

	// Detect selection type and active properties
	function detectSelectionType() {
		return new Promise((resolve) => {
			isInternalQuery = true;
			window.Asc.plugin.callCommand(function() {
				var result = { type: "text", properties: {} };
				try {
					var oDocument = Api.GetDocument();
					var oRange = oDocument.GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						if (pList && pList.length > 0) {
							if (pList[0].GetParentTable() !== null) {
								result.type = "table";
								return result;
							}
						}
						
						// Extract text formatting properties
						var fontName = "Calibri";
						var fontSize = 11;
						var bold = false;
						var italic = false;
						var underline = false;
						var strikeout = false;
						var color = "#000000";
						var shading = "#ffffff";
						
						if (pList && pList.length > 0) {
							var p = pList[0];
							var runCount = p.GetElementsCount();
							if (runCount > 0) {
								var firstRun = p.GetElement(0);
								if (firstRun) {
									try {
										if (typeof firstRun.GetFontFamily === "function") {
											fontName = firstRun.GetFontFamily() || fontName;
										} else if (typeof firstRun.GetFontNames === "function") {
											var names = firstRun.GetFontNames();
											if (names && names.length > 0) fontName = names[0] || fontName;
										} else if (typeof firstRun.GetFontName === "function") {
											fontName = firstRun.GetFontName() || fontName;
										}
									} catch(e) {}
									try { fontSize = (firstRun.GetFontSize() || 22) / 2; } catch(e) {}
									try { bold = !!firstRun.GetBold(); } catch(e) {}
									try { italic = !!firstRun.GetItalic(); } catch(e) {}
									try { underline = !!firstRun.GetUnderline(); } catch(e) {}
									try { strikeout = !!firstRun.GetStrikeout(); } catch(e) {}
									try {
										var c = firstRun.GetColor();
										if (c && c.GetHex) color = c.GetHex() || color;
									} catch(e) {}
								}
							}
							try {
								var pPr = p.GetParaPr();
								if (pPr && pPr.GetShd) {
									var sd = pPr.GetShd();
									if (sd) {
										if (typeof sd === "string") shading = sd;
										else if (sd.GetHex) shading = sd.GetHex() || shading;
									}
								}
							} catch(e) {}
						}
						result.properties = {
							fontName: fontName,
							fontSize: fontSize,
							bold: bold,
							italic: italic,
							underline: underline,
							strikeout: strikeout,
							color: color,
							shading: shading
						};
					}
				} catch(e) {}
				
				if (result.type === "text") {
					try {
						var oSelection = Api.GetSelection();
						if (oSelection) {
							var classType = oSelection.GetClassType();
							if (classType === "image" || classType === "ApiImage") {
								result.type = "image";
							} else if (classType === "shape" || classType === "ApiShape") {
								result.type = "shape";
								try {
									var fill = oSelection.GetFill();
									if (fill && fill.GetColor) result.properties.fill = fill.GetColor().GetHex();
									var outline = oSelection.GetOutline();
									if (outline && outline.GetColor) result.properties.outline = outline.GetColor().GetHex();
								} catch(e) {}
							} else if (classType === "chart" || classType === "ApiChart") {
								result.type = "chart";
							} else if (classType === "drawing" || classType === "ApiDrawing") {
								result.type = "shape";
							}
						}
					} catch(e) {}
				}
				return result;
			}, false, true, function(result) {
				if (!result || result.type === "none") {
					window.Asc.plugin.executeMethod("GetSelectionType", [], function(type) {
						isInternalQuery = false;
						lastInternalQueryTime = Date.now();
						if (type === "drawing") {
							resolve({ type: "image", properties: {} });
						} else {
							resolve({ type: "text", properties: {} });
						}
					});
				} else {
					isInternalQuery = false;
					lastInternalQueryTime = Date.now();
					resolve(result);
				}
			});
		});
	}

	// Render Contextual ONLYOFFICE Toolbar
	function renderContextToolbar(type, props = {}) {
		if (!contextToolbar) return;
		if (type === "none" || !type || type === "text") {
			contextToolbar.style.display = "none";
			return;
		}
		contextToolbar.style.display = "block";
		
		let html = "";
		if (type === "text") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Text Formatting</span>
						<span class="badge" style="font-size: 8px;">Text</span>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="tool-icon-btn ${props.bold ? 'active' : ''}" id="toolbar-bold" title="Bold" style="font-weight: bold;">B</button>
						<button class="tool-icon-btn ${props.italic ? 'active' : ''}" id="toolbar-italic" title="Italic" style="font-style: italic;">I</button>
						<button class="tool-icon-btn ${props.underline ? 'active' : ''}" id="toolbar-underline" title="Underline" style="text-decoration: underline;">U</button>
						<button class="tool-icon-btn ${props.strikeout ? 'active' : ''}" id="toolbar-strikeout" title="Strikeout" style="text-decoration: line-through;">S</button>
						
						<div style="width: 1px; height: 16px; background: var(--border-color); margin: 0 2px;"></div>
						
						<button class="tool-icon-btn" id="toolbar-align-left" title="Align Left">L</button>
						<button class="tool-icon-btn" id="toolbar-align-center" title="Align Center">C</button>
						<button class="tool-icon-btn" id="toolbar-align-right" title="Align Right">R</button>
						<button class="tool-icon-btn" id="toolbar-align-justify" title="Justify">J</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<select id="toolbar-font-family" style="flex: 1.5; height: 22px; padding: 2px 4px; font-size: 10px;">
							<option value="Calibri" ${props.fontName === 'Calibri' ? 'selected' : ''}>Calibri</option>
							<option value="Arial" ${props.fontName === 'Arial' ? 'selected' : ''}>Arial</option>
							<option value="Times New Roman" ${props.fontName === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
							<option value="Georgia" ${props.fontName === 'Georgia' ? 'selected' : ''}>Georgia</option>
							<option value="Courier New" ${props.fontName === 'Courier New' ? 'selected' : ''}>Courier New</option>
						</select>
						
						<select id="toolbar-font-size" style="flex: 1; height: 22px; padding: 2px 4px; font-size: 10px;">
							${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map(s => `
								<option value="${s}" ${Math.round(props.fontSize) === s ? 'selected' : ''}>${s}pt</option>
							`).join('')}
						</select>
						
						<input type="color" id="toolbar-font-color" value="${props.color || '#000000'}" title="Text Color" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						<input type="color" id="toolbar-shading-color" value="${props.shading || '#ffffff'}" title="Background Color" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
					</div>
				</div>
			`;
		} else if (type === "table") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Table Tools</span>
						<span class="badge" style="font-size: 8px; color: var(--accent-purple); border-color: var(--accent-purple);">Table</span>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-table-row-above" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Row Above</button>
						<button class="btn btn-outline" id="toolbar-table-row-below" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Row Below</button>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-table-col-left" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Col Left</button>
						<button class="btn btn-outline" id="toolbar-table-col-right" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Col Right</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<button class="btn btn-danger" id="toolbar-table-delete-row" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Del Row</button>
						<button class="btn btn-danger" id="toolbar-table-delete-col" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Del Col</button>
						<div style="display: flex; align-items: center; gap: 4px; flex: 1; justify-content: flex-end;">
							<span style="font-size: 9px; color: var(--text-secondary);">Bg:</span>
							<input type="color" id="toolbar-table-shading" value="#ffffff" title="Cell Shading" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
					</div>
				</div>
			`;
		} else if (type === "image") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Image Settings</span>
						<span class="badge" style="font-size: 8px; color: var(--success); border-color: var(--success);">Image</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-img-width" value="${props.width || '100'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-img-height" value="${props.height || '80'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-img-apply-size" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-img-rotate" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Rotate 90°</button>
					</div>
				</div>
			`;
		} else if (type === "shape") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Shape Format</span>
						<span class="badge" style="font-size: 8px; color: var(--info); border-color: var(--info);">Shape</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<div style="display: flex; align-items: center; gap: 4px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Fill:</span>
							<input type="color" id="toolbar-shape-fill" value="${props.fill || '#3498db'}" title="Fill Color" style="width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
						<div style="display: flex; align-items: center; gap: 4px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Line:</span>
							<input type="color" id="toolbar-shape-outline" value="${props.outline || '#000000'}" title="Outline Color" style="width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
						<div style="display: flex; align-items: center; gap: 2px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Wt:</span>
							<select id="toolbar-shape-weight" style="height: 20px; font-size: 9px; padding: 0 2px;">
								<option value="1" ${props.weight === 1 ? 'selected' : ''}>1pt</option>
								<option value="2" ${props.weight === 2 ? 'selected' : ''}>2pt</option>
								<option value="3" ${props.weight === 3 ? 'selected' : ''}>3pt</option>
								<option value="5" ${props.weight === 5 ? 'selected' : ''}>5pt</option>
							</select>
						</div>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-shape-width" value="${props.width || '50'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-shape-height" value="${props.height || '50'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-shape-apply" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
				</div>
			`;
		} else if (type === "chart") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Chart Editor</span>
						<span class="badge" style="font-size: 8px; color: var(--primary); border-color: var(--primary);">Chart</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<span style="font-size: 9px; color: var(--text-secondary); flex-shrink: 0;">Title:</span>
						<input type="text" id="toolbar-chart-title" value="${props.title || ''}" placeholder="Chart Title..." style="flex: 1; height: 22px; font-size: 10px; padding: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						<button class="btn btn-outline" id="toolbar-chart-apply-title" style="font-size: 9px; padding: 2px 6px; height: 22px; width: auto;">Set</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-chart-width" value="${props.width || '120'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-chart-height" value="${props.height || '90'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-chart-apply-size" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
				</div>
			`;
		}
		
		contextToolbar.innerHTML = html;
		bindToolbarListeners(type);
	}

	// Helper to bind toolbar click / select events
	function bindToolbarListeners(type) {
		if (type === "text") {
			const runTextCmd = (fn) => {
				window.Asc.plugin.callCommand(fn, false, true, () => {
					debouncedRefresh();
				});
			};

			document.getElementById("toolbar-bold").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetBold(!oRange.GetBold());
				});
			});

			document.getElementById("toolbar-italic").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetItalic(!oRange.GetItalic());
				});
			});

			document.getElementById("toolbar-underline").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetUnderline(!oRange.GetUnderline());
				});
			});

			document.getElementById("toolbar-strikeout").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetStrikeout(!oRange.GetStrikeout());
				});
			});

			const setAlign = (jc) => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						for (var i = 0; i < pList.length; i++) {
							pList[i].SetJc(Asc.scope.jc);
						}
					}
				});
			};

			document.getElementById("toolbar-align-left").addEventListener("click", () => {
				window.Asc.scope.jc = "left";
				setAlign("left");
			});
			document.getElementById("toolbar-align-center").addEventListener("click", () => {
				window.Asc.scope.jc = "center";
				setAlign("center");
			});
			document.getElementById("toolbar-align-right").addEventListener("click", () => {
				window.Asc.scope.jc = "right";
				setAlign("right");
			});
			document.getElementById("toolbar-align-justify").addEventListener("click", () => {
				window.Asc.scope.jc = "both";
				setAlign("both");
			});

			document.getElementById("toolbar-font-family").addEventListener("change", (e) => {
				window.Asc.scope.fontName = e.target.value;
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetFontName(Asc.scope.fontName);
				});
			});

			document.getElementById("toolbar-font-size").addEventListener("change", (e) => {
				window.Asc.scope.fontSize = parseInt(e.target.value) * 2;
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetFontSize(Asc.scope.fontSize);
				});
			});

			document.getElementById("toolbar-font-color").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetColor(Asc.scope.r, Asc.scope.g, Asc.scope.b);
				});
			});

			document.getElementById("toolbar-shading-color").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						for (var i = 0; i < pList.length; i++) {
							pList[i].SetShd(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						}
					}
				});
			});

		} else if (type === "table") {
			const runTableCmd = (fn) => {
				window.Asc.plugin.callCommand(fn, false, true, () => {
					debouncedRefresh();
				});
			};

			document.getElementById("toolbar-table-row-above").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddRow(res.cell, true);
					}
				});
			});

			document.getElementById("toolbar-table-row-below").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddRow(res.cell, false);
					}
				});
			});

			document.getElementById("toolbar-table-col-left").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddColumn(res.cell, true);
					}
				});
			});

			document.getElementById("toolbar-table-col-right").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddColumn(res.cell, false);
					}
				});
			});

			document.getElementById("toolbar-table-delete-row").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						var table = res.table;
						var activeRowIndex = -1;
						var rowsCount = table.GetRowsCount();
						for (var r = 0; r < rowsCount; r++) {
							var row = table.GetRow(r);
							var cellsCount = row.GetCellsCount();
							for (var c = 0; c < cellsCount; c++) {
								if (row.GetCell(c) === res.cell) {
									activeRowIndex = r;
									break;
								}
							}
							if (activeRowIndex !== -1) break;
						}
						if (activeRowIndex !== -1) {
							table.RemoveRow(activeRowIndex);
						}
					}
				});
			});

			document.getElementById("toolbar-table-delete-col").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.cell.RemoveColumn();
					}
				});
			});

			document.getElementById("toolbar-table-shading").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.table) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var rowsCount = res.table.GetRowsCount();
						for (var rowIdx = 0; rowIdx < rowsCount; rowIdx++) {
							var row = res.table.GetRow(rowIdx);
							var cellsCount = row.GetCellsCount();
							for (var colIdx = 0; colIdx < cellsCount; colIdx++) {
								var cell = row.GetCell(colIdx);
								var cellParas = cell.GetContent().GetAllParagraphs();
								var isCellSelected = false;
								for (var cp = 0; cp < cellParas.length; cp++) {
									for (var sp = 0; sp < res.pList.length; sp++) {
										if (cellParas[cp] === res.pList[sp]) {
											isCellSelected = true;
											break;
										}
									}
									if (isCellSelected) break;
								}
								if (isCellSelected) {
									cell.SetBackgroundColor(colorObj);
								}
							}
						}
					}
				});
			});

		} else if (type === "image") {
			document.getElementById("toolbar-img-apply-size").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-img-width").value);
				const h = parseFloat(document.getElementById("toolbar-img-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-img-rotate").addEventListener("click", () => {
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var r = 0;
						try { r = oSelection.GetRotation() || 0; } catch(e) {}
						try { oSelection.SetRotation((r + 90) % 360); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

		} else if (type === "shape") {
			document.getElementById("toolbar-shape-fill").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var fill = Api.CreateSolidFill(colorObj);
						try { oSelection.SetFill(fill); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-outline").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var stroke = Api.CreateStroke(12700, Api.CreateSolidFill(colorObj));
						try { oSelection.SetOutline(stroke); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-weight").addEventListener("change", (e) => {
				window.Asc.scope.weight = parseFloat(e.target.value) * 12700;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var stroke = Api.CreateStroke(Asc.scope.weight);
						try { oSelection.SetOutline(stroke); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-apply").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-shape-width").value);
				const h = parseFloat(document.getElementById("toolbar-shape-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

		} else if (type === "chart") {
			document.getElementById("toolbar-chart-apply-title").addEventListener("click", () => {
				window.Asc.scope.title = document.getElementById("toolbar-chart-title").value;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetTitle(Asc.scope.title, 24); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-chart-apply-size").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-chart-width").value);
				const h = parseFloat(document.getElementById("toolbar-chart-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});
		}
	}

	let lastSelectionType = null;
	async function updateDynamicToolbar() {
		try {
			const res = await detectSelectionType();
			if (res.type !== lastSelectionType) {
				lastSelectionType = res.type;
				renderContextToolbar(res.type, res.properties);
			}
		} catch(e) {
			console.error("Error updating toolbar:", e);
		}
	}

	// Execution Telemetry Debug State
	let lastExecutionDebugData = {
		timestamp: null,
		intent: null,
		serializationMode: null,
		userPrompt: null,
		systemPrompt: null,
		fullUserPrompt: null,
		rawResponse: null,
		parsedPlans: null,
		stateBefore: [],
		stateAfter: [],
		status: "No executions yet"
	};

	const debugViewerContent = document.getElementById('debug-viewer-content');
	const copyDebugLogBtn = document.getElementById('copy-debug-log');
	const clearDebugLogBtn = document.getElementById('clear-debug-log');

	function updateDebugViewer() {
		if (!debugViewerContent) return;
		
		if (!lastExecutionDebugData.timestamp) {
			debugViewerContent.textContent = "No execution data captured yet. Execute an AI command to see step-by-step telemetry logs here.";
			return;
		}

		const fullLog = `======================================================================
📋 AI PIPELINE TELEMETRY SUMMARY
======================================================================
Timestamp:          ${lastExecutionDebugData.timestamp || 'N/A'}
Status:             ${lastExecutionDebugData.status || 'N/A'}
Intent Router:      ${lastExecutionDebugData.intent || 'N/A'}
Serialization Mode: ${lastExecutionDebugData.serializationMode || 'N/A'}
User Prompt:        "${lastExecutionDebugData.userPrompt || ''}"
Logical Steps Count: ${lastExecutionDebugData.parsedPlans ? lastExecutionDebugData.parsedPlans.length : 0}

======================================================================
💬 ACTIVE LLM PROMPTS
======================================================================
--- SYSTEM PROMPT (RULES INJECTED) ---
${lastExecutionDebugData.systemPrompt || 'N/A'}

--- USER MESSAGE (EXTRACTED CONTEXT & PROMPT) ---
${lastExecutionDebugData.fullUserPrompt || 'N/A'}

======================================================================
🔍 DOCUMENT STATE BEFORE CHANGES
======================================================================
${JSON.stringify(lastExecutionDebugData.stateBefore, null, 2)}

======================================================================
✨ DOCUMENT STATE AFTER CHANGES (WITH VERIFICATION OUTPUT)
======================================================================
${JSON.stringify(lastExecutionDebugData.stateAfter, null, 2)}

======================================================================
🤖 RAW LLM RESPONSE & ACTIONS DECODED
======================================================================
--- RAW RESPONSE ---
${lastExecutionDebugData.rawResponse || 'N/A'}

--- DECODED PLAN STEPS ---
${JSON.stringify(lastExecutionDebugData.parsedPlans || [], null, 2)}
`;

		debugViewerContent.textContent = fullLog;
	}

	if (copyDebugLogBtn) {
		copyDebugLogBtn.addEventListener('click', () => {
			const text = debugViewerContent.textContent;
			if (!text || text.startsWith("No execution data")) return;
			navigator.clipboard.writeText(text).then(() => {
				const originalText = copyDebugLogBtn.innerText;
				copyDebugLogBtn.innerText = "Copied! ✓";
				setTimeout(() => { copyDebugLogBtn.innerText = originalText; }, 1500);
			});
		});
	}

	if (clearDebugLogBtn) {
		clearDebugLogBtn.addEventListener('click', () => {
			lastExecutionDebugData = {
				timestamp: null,
				intent: null,
				serializationMode: null,
				userPrompt: null,
				systemPrompt: null,
				fullUserPrompt: null,
				rawResponse: null,
				parsedPlans: null,
				stateBefore: [],
				stateAfter: [],
				status: "No executions yet"
			};
			updateDebugViewer();
			log("Cleared execution debugger telemetry logs.", "info");
		});
	}

	// Supported Intents for the Router Layer
	const INTENTS = {
		CHAT: "chat",
		REWRITE: "rewrite",
		SUMMARIZE: "summarize",
		TRANSLATE: "translate",
		FORMAT: "format",
		CREATE_DOCUMENT: "create_document",
		INSERT_CONTENT: "insert_content",
		DELETE_CONTENT: "delete_content",
		RESTRUCTURE: "restructure",
		ANALYZE: "analyze"
	};

	// Local Rule Engine rules per intent
	const RULES = {
		rewrite: {
			instructions: "1. Focus on writing beautiful, professional, context-appropriate text.\n2. Do NOT change visual styling properties (bold, italic, font family) in this plan unless explicitly requested.\n3. Return a high-level action 'rewrite' for the paragraph indices to update.\n4. If inserting extra sections or adding new text blocks, specify 'create_paragraph' or 'paste_html' actions with matching styles or properties (bold for headings) to maintain layout consistency."
		},
		summarize: {
			instructions: "1. Condense the text into 3 to 5 clear, high-quality, professional bullet points starting with standard dash '-' prefixes.\n2. Return a high-level action 'paste_html' or 'rewrite' with the summary bullets.\n3. Do not generate visual changes unless asked."
		},
		translate: {
			instructions: "1. Translate the text into the target language with perfect grammatical accuracy.\n2. Keep paragraph structure identical. Do not alter styling.\n3. Return a 'rewrite' action for the paragraph indices."
		},
		format: {
			instructions: "1. Focus ONLY on styling (fontName, fontSize, bold, italic, color, alignment, spacing, shading, lists, and indentation).\n2. Do NOT rewrite the text content of the paragraphs unless explicitly requested.\n3. Return 'change_font', 'change_color', 'make_list', 'change_indent', or 'table_action' high-level actions depending on styling or layout goals.\n4. STYLE TEMPLATE GUIDELINES:\n   - CONFERENCE PAPER: Use Font: 'Times New Roman'. Title (first paragraph): 24pt, bold, center aligned. Section Headings (Introduction, History, etc.): 12pt or 14pt, bold, numbered (e.g. '1. Introduction'), spacing before 240 dxa, spacing after 120 dxa, left-aligned. Body Paragraphs: 10pt or 11pt, justify aligned, line spacing 1.0 or 1.15, first line indent 360 dxa (0.25 inch), spacing after 120 dxa.\n   - FORMAL LETTER: Font: 'Times New Roman' or 'Calibri'. Left aligned. Body paragraphs: 11pt, line spacing 1.15, spacing after 180 dxa, no indents.\n   - MODERN EXECUTIVE/REPORT: Font: 'Arial' or 'Calibri'. Headings: 14pt or 16pt, bold, Navy color ('#1e40af'), spacing before 300 dxa, spacing after 120 dxa. Body: 11pt, justify aligned, line spacing 1.15, spacing after 120 dxa."
		},
		create_document: {
			instructions: "1. Generate a beautifully structured document, essay, report, or article using professional formatting rules.\n2. Heavily use 'paste_html' action with high-fidelity styled HTML strings.\n3. Create proper heading hierarchies (<h1 style='...'>, <h2 style='...'>, <p style='text-align:justify;'>)."
		},
		insert_content: {
			instructions: "1. Insert new paragraphs or tables at the correct target index.\n2. Return 'create_paragraph', 'paste_html', or 'table_action' (subAction: 'create', 'add_row', 'add_column') actions.\n3. To maintain layout consistency, always copy or match the formatting properties of the surrounding paragraphs (e.g., if inserting a body paragraph, use the body font/size; if inserting a heading, make it bold and larger)."
		},
		delete_content: {
			instructions: "1. Remove targeted content, paragraphs, tables, or sections.\n2. Return 'delete_paragraph' or 'table_action' (subAction: 'delete_row', 'delete_column') high-level actions."
		},
		restructure: {
			instructions: "1. Reorganize headings, change layouts or margins.\n2. Return correct sequence of high-level actions (delete, create, format) to achieve structure."
		},
		analyze: {
			instructions: "1. Read document text and identify issues, grammar, tone, flow.\n2. Return logical list of rewrite actions to correct found issues."
		}
	};

	// View Tabs Navigation
	function switchTab(activeTab, activeView, titleText) {
		[tabPrompt, tabStructure, tabConsole, tabSettings].forEach(tab => {
			if (tab) tab.classList.toggle('active', tab === activeTab);
		});
		[viewPrompt, viewStructure, viewConsole, viewSettings].forEach(view => {
			if (view) view.classList.toggle('active', view === activeView);
		});
		const activeViewTitle = document.getElementById('active-view-title');
		if (activeViewTitle) {
			activeViewTitle.innerText = titleText;
		}
	}

	tabPrompt.addEventListener('click', () => switchTab(tabPrompt, viewPrompt, 'Chat Assistant'));
	tabStructure.addEventListener('click', () => {
		switchTab(tabStructure, viewStructure, 'Document Outline');
		refreshDocStructureView();
	});
	tabConsole.addEventListener('click', () => switchTab(tabConsole, viewConsole, 'Dev Console'));
	tabSettings.addEventListener('click', () => {
		switchTab(tabSettings, viewSettings, 'Settings');
		renderCheckpointsUI();
	});

	// Dev Console inner tabs
	if (btnTabLogs && btnTabTelemetry) {
		btnTabLogs.addEventListener('click', () => {
			btnTabLogs.classList.add('active');
			btnTabTelemetry.classList.remove('active');
			paneLogs.classList.add('active');
			paneTelemetry.classList.remove('active');
		});
		btnTabTelemetry.addEventListener('click', () => {
			btnTabTelemetry.classList.add('active');
			btnTabLogs.classList.remove('active');
			paneTelemetry.classList.add('active');
			paneLogs.classList.remove('active');
		});
	}

	// Slash Command Popup Autocomplete Menu
	if (promptInput && slashMenu) {
		promptInput.addEventListener('input', (e) => {
			const val = e.target.value;
			if (val === '/') {
				slashMenu.style.display = 'block';
				// select first item
				const items = slashMenu.querySelectorAll('.slash-item');
				items.forEach((item, idx) => {
					item.classList.toggle('selected', idx === 0);
				});
			} else if (!val.startsWith('/')) {
				slashMenu.style.display = 'none';
			}
		});

		document.addEventListener('click', (e) => {
			if (!e.target.closest('#chat-input-bar') && !e.target.closest('#slash-menu')) {
				slashMenu.style.display = 'none';
			}
		});

		slashMenu.querySelectorAll('.slash-item').forEach(item => {
			item.addEventListener('click', () => {
				const cmd = item.getAttribute('data-cmd');
				promptInput.value = cmd + ' ';
				slashMenu.style.display = 'none';
				promptInput.focus();
			});
		});
	}

	// Selection Context Scope Badge is updated dynamically by refreshDocStructureView

	// Scan range is now dynamic and automatic

	// API Key Visibility Toggle
	toggleKeyVisibility.addEventListener('click', () => {
		if (apiKeyInput.type === 'password') {
			apiKeyInput.type = 'text';
			toggleKeyVisibility.innerText = 'HIDE';
		} else {
			apiKeyInput.type = 'password';
			toggleKeyVisibility.innerText = 'SHOW';
		}
	});

	// Accordion toggle handler for Settings cards
	document.querySelectorAll('.card-header').forEach(header => {
		header.addEventListener('click', (e) => {
			if (e.target.closest('#copy-debug-log') || e.target.closest('#clear-debug-log') || e.target.closest('#clear-logs') || e.target.closest('#copy-log-file-btn') || e.target.closest('#reset-logs')) {
				return; // Prevent toggle when clicking header actions
			}
			const body = header.nextElementSibling;
			const chevron = header.querySelector('.accordion-chevron');
			if (body && body.classList.contains('card-body')) {
				if (body.style.display === 'none' || body.style.display === '') {
					body.style.display = 'block';
					if (chevron) chevron.innerText = '▼';
				} else {
					body.style.display = 'none';
					if (chevron) chevron.innerText = '►';
				}
			}
		});
	});

	// Copy Developer Log File click handler
	const copyLogFileBtn = document.getElementById('copy-log-file-btn');
	if (copyLogFileBtn) {
		copyLogFileBtn.addEventListener('click', () => {
			const logContent = logLines.length > 0 ? logLines.join('\n') : "No log entries recorded yet.";
			navigator.clipboard.writeText(logContent).then(() => {
				log('Copied all developer logs to clipboard.', 'success');
				copyLogFileBtn.innerText = 'Copied!';
				setTimeout(() => {
					copyLogFileBtn.innerText = 'Copy Log';
				}, 1500);
			}).catch(err => {
				log('Failed to copy logs: ' + err.message, 'error');
			});
		});
	}

	// Available models with relative cost mappings
	const providerModels = {
		groq: [
			{ value: 'llama-3.3-70b-versatile', text: 'Llama 3.3 70B (Recommended) [0.5x cost]', cost: '0.5x' },
			{ value: 'llama-3.1-8b-instant', text: 'Llama 3.1 8B (Fast) [0.05x cost]', cost: '0.05x' },
			{ value: 'llama-3.2-3b-preview', text: 'Llama 3.2 3B (Lightweight) [0.02x cost]', cost: '0.02x' },
			{ value: 'llama-3.2-1b-preview', text: 'Llama 3.2 1B (Ultra-fast) [0.01x cost]', cost: '0.01x' },
			{ value: 'deepseek-r1-distill-qwen-32b', text: 'DeepSeek R1 32B (Reasoning) [0.2x cost]', cost: '0.2x' },
			{ value: 'deepseek-r1-distill-llama-70b', text: 'DeepSeek R1 70B (Reasoning) [0.5x cost]', cost: '0.5x' }
		]
	};

	// Initialize active provider select options
	// Helper to adjust settings fields visibility based on selected provider
	function adjustSettingsFieldsVisibility() {
		const provider = providerSelect.value;
		if (provider === 'groq') {
			urlConfigGroup.style.display = 'none';
			keyConfigGroup.style.display = 'block';
			modelSelectGroup.style.display = 'block';
			localModelSelectGroup.style.display = 'none';
			modelInputGroup.style.display = 'none';
			if (modelCostBadge) modelCostBadge.style.display = 'inline-block';
			updateCostBadge();
		} else {
			urlConfigGroup.style.display = 'block';
			keyConfigGroup.style.display = provider === 'custom' ? 'block' : 'none';
			modelSelectGroup.style.display = 'none';
			if (modelCostBadge) modelCostBadge.style.display = 'none';
			
			// Load dynamic cached local models
			const cachedStr = localStorage.getItem('onescript_fetched_models');
			const forceManual = localStorage.getItem('onescript_force_manual_model') === 'true';
			
			if (cachedStr && !forceManual) {
				try {
					const modelNames = JSON.parse(cachedStr);
					if (Array.isArray(modelNames) && modelNames.length > 0) {
						localModelSelect.innerHTML = modelNames.map(name => `<option value="${name}">${name}</option>`).join('');
						const savedModel = localStorage.getItem('onescript_model') || modelNames[0];
						localModelSelect.value = modelNames.includes(savedModel) ? savedModel : modelNames[0];
						
						localModelSelectGroup.style.display = 'block';
						modelInputGroup.style.display = 'none';
					} else {
						localModelSelectGroup.style.display = 'none';
						modelInputGroup.style.display = 'block';
					}
				} catch(e) {
					localModelSelectGroup.style.display = 'none';
					modelInputGroup.style.display = 'block';
				}
			} else {
				localModelSelectGroup.style.display = 'none';
				modelInputGroup.style.display = 'block';
				if (forceManual && cachedStr) {
					toggleDropdownModel.style.display = 'inline-block';
				} else {
					toggleDropdownModel.style.display = 'none';
				}
			}
			
			if (!apiUrlInput.value.trim()) {
				apiUrlInput.value = provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080/v1';
			}
			if (!modelInput.value.trim()) {
				modelInput.value = provider === 'ollama' ? 'llama3' : 'model';
			}
		}
	}

	// Initialize active provider select options
	function initializeProvider() {
		// Populate Groq models
		modelSelect.innerHTML = providerModels.groq.map(m => `<option value="${m.value}">${m.text}</option>`).join('');
		
		const provider = localStorage.getItem('onescript_provider') || 'groq';
		providerSelect.value = provider;
		
		const model = localStorage.getItem('onescript_model') || localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
		
		if (provider === 'groq') {
			modelSelect.value = model;
		} else {
			modelInput.value = model;
		}

		const apiUrl = localStorage.getItem('onescript_api_url') || '';
		apiUrlInput.value = apiUrl;
		
		adjustSettingsFieldsVisibility();
	}

	// Update Dynamic Model Relative Cost Badge
	function updateCostBadge() {
		if (!modelCostBadge || !modelSelect || providerSelect.value !== 'groq') {
			if (modelCostBadge) modelCostBadge.style.display = 'none';
			return;
		}
		
		const currentModel = modelSelect.value;
		const models = providerModels.groq;
		const selectedModel = models.find(m => m.value === currentModel);
		
		if (selectedModel && selectedModel.cost) {
			const costVal = parseFloat(selectedModel.cost.replace('x', ''));
			modelCostBadge.innerText = selectedModel.cost + ' Cost';
			modelCostBadge.style.display = 'inline-block';
			
			// Dynamic color schemes (Tokyo Night Tailored HSL color tones)
			if (costVal < 0.3) {
				modelCostBadge.style.color = '#10b981';
				modelCostBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
				modelCostBadge.style.background = 'rgba(16, 185, 129, 0.1)';
			} else if (costVal <= 1.0) {
				modelCostBadge.style.color = '#f59e0b';
				modelCostBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
				modelCostBadge.style.background = 'rgba(245, 158, 11, 0.1)';
			} else {
				modelCostBadge.style.color = '#f43f5e';
				modelCostBadge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
				modelCostBadge.style.background = 'rgba(244, 63, 94, 0.1)';
			}
		} else {
			modelCostBadge.style.display = 'none';
		}
	}

	// Fetch models from Ollama or llama.cpp/Custom OpenAI compatible server
	async function fetchLocalModels(provider, baseUrl, apiKey = '') {
		let fetchUrl = '';
		let headers = { 'Content-Type': 'application/json' };
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}
		
		if (provider === 'ollama') {
			let url = baseUrl.trim() || 'http://localhost:11434';
			if (url.endsWith('/')) url = url.substring(0, url.length - 1);
			fetchUrl = url + '/api/tags';
		} else {
			let url = baseUrl.trim() || 'http://localhost:8080/v1';
			if (url.endsWith('/')) url = url.substring(0, url.length - 1);
			if (url.endsWith('/v1')) {
				fetchUrl = url + '/models';
			} else {
				fetchUrl = url + '/v1/models';
			}
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout

		try {
			const res = await fetch(fetchUrl, {
				method: 'GET',
				headers: headers,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`);
			}
			const data = await res.json();
			return { success: true, data: data };
		} catch (err) {
			clearTimeout(timeoutId);
			if (provider === 'custom') {
				try {
					let fallbackUrl = baseUrl.trim();
					if (fallbackUrl.endsWith('/')) fallbackUrl = fallbackUrl.substring(0, fallbackUrl.length - 1);
					const res2 = await fetch(fallbackUrl + '/models', {
						method: 'GET',
						headers: headers
					});
					if (res2.ok) {
						const data2 = await res2.json();
						return { success: true, data: data2 };
					}
				} catch(e) {}
			}
			return { success: false, error: err.message };
		}
	}

	// Load Saved Settings from localStorage
	function loadSettings() {
		const savedKey = localStorage.getItem('onescript_api_key') || localStorage.getItem('groq_copilot_key');
		if (savedKey) {
			apiKeyInput.value = savedKey;
		}
		initializeProvider();
		log('OneScript settings loaded securely.', 'success');
	}

	// Save Settings Actions
	saveKeyBtn.addEventListener('click', () => {
		const provider = providerSelect.value;
		const key = apiKeyInput.value.trim();
		const url = apiUrlInput.value.trim();
		
		let model = '';
		if (provider === 'groq') {
			model = modelSelect.value;
		} else {
			const isManual = modelInputGroup.style.display !== 'none';
			if (isManual) {
				model = modelInput.value.trim();
			} else {
				model = localModelSelect.value;
			}
		}
		
		if (provider === 'groq' && !key) {
			log('Error: Groq API Key cannot be empty.', 'error');
			return;
		}
		if (provider === 'custom' && !url) {
			log('Error: Custom provider requires a Base URL.', 'error');
			return;
		}
		if (provider === 'ollama' && !url) {
			log('Error: Ollama provider requires a Base URL.', 'error');
			return;
		}
		
		localStorage.setItem('onescript_provider', provider);
		localStorage.setItem('onescript_api_key', key);
		localStorage.setItem('groq_copilot_key', key); // backward compatibility
		localStorage.setItem('onescript_api_url', url);
		localStorage.setItem('onescript_model', model);
		localStorage.setItem('groq_copilot_model', model); // backward compatibility
		
		log('AI settings saved successfully!', 'success');
		tabPrompt.click(); // Switch back to editor tab
	});

	// Load Models Button Actions
	loadModelsBtn.addEventListener('click', async (e) => {
		e.preventDefault();
		const provider = providerSelect.value;
		const url = apiUrlInput.value.trim();
		const key = apiKeyInput.value.trim();
		
		if (!url) {
			log('Error: Please enter a Base URL first.', 'error');
			return;
		}
		
		loadModelsBtn.disabled = true;
		loadModelsBtn.innerText = 'Loading...';
		log(`Attempting to load models from ${provider} at ${url}...`, 'info');
		
		const res = await fetchLocalModels(provider, url, key);
		loadModelsBtn.disabled = false;
		loadModelsBtn.innerText = 'Load Models';
		
		if (!res.success) {
			log(`Failed to fetch models: ${res.error}. Enter model name manually.`, 'error');
			localStorage.removeItem('onescript_fetched_models');
			localStorage.setItem('onescript_force_manual_model', 'true');
			adjustSettingsFieldsVisibility();
			return;
		}
		
		let modelNames = [];
		try {
			const data = res.data;
			if (provider === 'ollama') {
				if (data && Array.isArray(data.models)) {
					modelNames = data.models.map(m => m.name);
				}
			} else {
				if (data && Array.isArray(data.data)) {
					modelNames = data.data.map(m => m.id);
				} else if (data && Array.isArray(data)) {
					modelNames = data.map(m => typeof m === 'string' ? m : (m.id || m.name));
				}
			}
		} catch(err) {
			log(`Error parsing model list response: ${err.message}`, 'error');
		}
		
		if (modelNames.length === 0) {
			log('No models returned from server. Enter model name manually.', 'warning');
			localStorage.removeItem('onescript_fetched_models');
			localStorage.setItem('onescript_force_manual_model', 'true');
			adjustSettingsFieldsVisibility();
			return;
		}
		
		log(`Loaded ${modelNames.length} available models successfully!`, 'success');
		localStorage.setItem('onescript_fetched_models', JSON.stringify(modelNames));
		localStorage.setItem('onescript_force_manual_model', 'false');
		adjustSettingsFieldsVisibility();
	});

	// Toggle manual input links
	toggleManualModel.addEventListener('click', () => {
		localStorage.setItem('onescript_force_manual_model', 'true');
		localModelSelectGroup.style.display = 'none';
		modelInputGroup.style.display = 'block';
		toggleDropdownModel.style.display = 'inline-block';
	});

	toggleDropdownModel.addEventListener('click', () => {
		localStorage.setItem('onescript_force_manual_model', 'false');
		adjustSettingsFieldsVisibility();
	});

	// Remove/Clear Key Actions
	removeKeyBtn.addEventListener('click', () => {
		localStorage.removeItem('onescript_api_key');
		localStorage.removeItem('groq_copilot_key');
		apiKeyInput.value = '';
		log('API Key removed.', 'warning');
	});

	// Switch fields visibility on provider change
	providerSelect.addEventListener('change', () => {
		adjustSettingsFieldsVisibility();
	});

	// Save Model Choice on select and update cost indicator
	modelSelect.addEventListener('change', () => {
		localStorage.setItem('onescript_model', modelSelect.value);
		localStorage.setItem('groq_copilot_model', modelSelect.value);
		log(`Model switched to Groq: ${modelSelect.value}`, 'info');
		updateCostBadge();
	});

	// Save Local Model Choice on change
	localModelSelect.addEventListener('change', () => {
		localStorage.setItem('onescript_model', localModelSelect.value);
		localStorage.setItem('groq_copilot_model', localModelSelect.value);
		log(`Model switched to Local: ${localModelSelect.value}`, 'info');
	});

	// Initial welcome screen render and Suggestion Chips handler
	renderWelcomeScreen();

	// Logging persistence helpers
	function loadLogFile() {
		const savedLog = localStorage.getItem(logStorageKey);
		logLines = savedLog ? savedLog.split('\n').filter(Boolean) : [];
	}

	function clearLogFile() {
		logLines = [];
		localStorage.removeItem(logStorageKey);
		if (logContainer) {
			logContainer.innerHTML = '';
		}
		log('Developer log file cleared.', 'warning');
	}

	function downloadLogFile() {
		const logContent = logLines.length > 0 ? logLines.join('\n') : "No log entries recorded yet.";
		const blob = new Blob([logContent + '\n'], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `onescript-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	// Persistent logs event handlers
	if (clearLogsBtn) {
		clearLogsBtn.addEventListener('click', () => {
			downloadLogFile();
			log('Downloaded the stored log file.', 'info');
		});
	}

	if (resetLogsBtn) {
		resetLogsBtn.addEventListener('click', () => {
			clearLogFile();
		});
	}

	// Logger helper
	function log(message, type = 'default') {
		const timestamp = new Date().toISOString();
		const line = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
		logLines.push(line);
		localStorage.setItem(logStorageKey, logLines.join('\n'));
		if (typeof console !== 'undefined' && console.log) {
			console.log(line);
		}
		if (logContainer) {
			const entry = document.createElement('div');
			entry.className = `log-entry ${type}`;
			entry.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> <span>${message}</span>`;
			logContainer.appendChild(entry);
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	}

	// Render Interactive Outline Tree Map
	function renderOutlineTree(parsed, container) {
		container.innerHTML = '';
		if (!parsed || !parsed.sections || parsed.sections.length === 0) {
			container.innerHTML = '<div class="outline-empty">No outline elements found.</div>';
			return;
		}

		// Create metadata header/indicator
		const metaHeader = document.createElement('div');
		metaHeader.className = 'outline-meta-header';
		metaHeader.innerHTML = `
			<span class="meta-mode">${parsed.mode === 'selection' ? 'Selection' : 'Entire Document'}</span>
			<span class="meta-count">${parsed.metadata.totalElements} elements</span>
		`;
		container.appendChild(metaHeader);

		parsed.sections.forEach((section, sIdx) => {
			// Create Section Node
			const sectionNode = document.createElement('div');
			sectionNode.className = 'outline-section-node';
			
			const sectionTitle = document.createElement('div');
			sectionTitle.className = 'outline-section-title';
			sectionTitle.innerHTML = `
				<span class="section-caret">▼</span>
				<span class="section-icon">📂</span>
				<span class="section-label" title="${section.title}">${section.title}</span>
			`;
			sectionNode.appendChild(sectionTitle);
			
			const sectionElements = document.createElement('div');
			sectionElements.className = 'outline-section-elements';
			
			if (section.elements && section.elements.length > 0) {
				section.elements.forEach(el => {
					const elNode = document.createElement('div');
					elNode.className = `outline-el-node type-${el.type}`;
					if (parsed.metadata.cursorIndex === el.index) {
						elNode.classList.add('caret-focus');
					}
					
					let icon = '📝';
					let displayText = el.text ? el.text.trim() : '';
					let detailBadge = '';
					
					if (el.type === 'table') {
						icon = '🗂️';
						const rows = el.rows ? el.rows.length : 0;
						const cols = el.rows && el.rows[0] && el.rows[0].cells ? el.rows[0].cells.length : 0;
						displayText = `Table (${rows}x${cols})`;
						detailBadge = `<span class="el-badge table">TABLE</span>`;
					} else if (el.type === 'paragraph') {
						if (el.style) {
							if (el.style.styleName) {
								const isHeading = el.style.styleName.toLowerCase().includes('heading');
								if (isHeading) {
									icon = '🏷️';
									elNode.classList.add('heading-node');
									detailBadge = `<span class="el-badge heading">${el.style.styleName.replace(/heading/i, 'H')}</span>`;
								} else if (el.style.listType) {
									icon = el.style.listType === 'numbered' ? '🔢' : '•';
									detailBadge = `<span class="el-badge list">LIST</span>`;
								}
							}
						}
						if (!displayText) {
							displayText = '[Empty Paragraph]';
							elNode.classList.add('empty-node');
						}
					}
					
					// Style overrides
					let styleAttr = '';
					if (el.style) {
						if (el.style.bold) styleAttr += 'font-weight: bold;';
						if (el.style.italic) styleAttr += 'font-style: italic;';
						if (el.style.underline) styleAttr += 'text-decoration: underline;';
						if (el.style.color && el.style.color !== '#000000') styleAttr += `color: ${el.style.color};`;
					}
					
					elNode.innerHTML = `
						<span class="el-icon">${icon}</span>
						<span class="el-text" style="${styleAttr}" title="${el.text || ''}">${displayText.substring(0, 45)}${displayText.length > 45 ? '...' : ''}</span>
						<div class="el-meta">
							${detailBadge}
							<span class="el-index">#${el.index + 1}</span>
						</div>
					`;
					
					// Click handler to select paragraph in ONLYOFFICE!
					elNode.addEventListener('click', () => {
						// Remove active focus class from others
						container.querySelectorAll('.outline-el-node').forEach(node => node.classList.remove('active-focus'));
						elNode.classList.add('active-focus');
						
						log(`Selecting Document Element #${el.index + 1} in editor...`, 'info');
						window.Asc.scope.targetSelectIndex = el.index;
						window.Asc.plugin.callCommand(function() {
							var oDocument = Api.GetDocument();
							var oElement = oDocument.GetElement(Asc.scope.targetSelectIndex);
							if (oElement) {
								try {
									oElement.Select();
								} catch(err) {
									return "err: " + err.message;
								}
								return "success";
							}
							return "notfound";
						}, false, true, function(res) {
							if (res && res.indexOf("err") !== -1) {
								log("Error selecting element: " + res, "error");
							} else if (res === "notfound") {
								log("Element not found in document.", "warning");
							} else {
								log(`Element #${el.index + 1} selected.`, "success");
							}
						});
					});
					
					sectionElements.appendChild(elNode);
				});
			} else {
				sectionElements.innerHTML = '<div class="outline-empty-section">No elements in section</div>';
			}
			
			sectionNode.appendChild(sectionElements);
			
			// Toggle section collapse/expand
			sectionTitle.addEventListener('click', () => {
				const isCollapsed = sectionElements.style.display === 'none';
				sectionElements.style.display = isCollapsed ? 'flex' : 'none';
				sectionTitle.querySelector('.section-caret').innerText = isCollapsed ? '▼' : '►';
			});
			
			container.appendChild(sectionNode);
		});
	}

	// Dynamic Document JSON Viewer compiler (debounced and fully dynamic)
	let isScanning = false;
	let scanPending = false;
	let isEditingAutonomously = false;
	let referenceTemplates = null;
	async function refreshDocStructureView() {
		if (isEditingAutonomously) return;
		if (isScanning) {
			scanPending = true;
			return;
		}
		isScanning = true;
		scanPending = false;

		if (outlineTreeContainer) {
			outlineTreeContainer.classList.add('scanning-refreshed');
			if (outlineTreeContainer.innerHTML === '' || outlineTreeContainer.querySelector('.outline-loading')) {
				outlineTreeContainer.innerHTML = '<div class="outline-loading">Scanning document...</div>';
			}
		}
		structureJson.value = "Scanning active document structure JSON...";
		try {
			isInternalQuery = true;
			const docJSON = await serializeActiveContent();
			const parsed = parseSerializedData(docJSON);
			structureJson.value = JSON.stringify(parsed, null, 2);

			// Render Outline Tree Map
			if (outlineTreeContainer) {
				renderOutlineTree(parsed, outlineTreeContainer);
			}

			// Update the context scope badge
			const badge = document.getElementById('prompt-scope-badge');
			if (badge) {
				const hasSelection = parsed.mode === 'selection';
				badge.innerText = hasSelection ? 'Selection' : 'Entire Doc';
				badge.style.borderColor = hasSelection ? 'rgba(16, 185, 129, 0.4)' : 'rgba(122, 162, 247, 0.3)';
				badge.style.color = hasSelection ? 'var(--accent-green)' : 'var(--primary)';
				badge.style.background = hasSelection ? 'rgba(16, 185, 129, 0.08)' : 'var(--primary-glow)';
			}

			// Update dynamic toolbar sequentially to avoid queue collision
			try {
				await updateDynamicToolbar();
			} catch(eToolbar) {}

			log(`Compiled structural JSON successfully [Mode: ${parsed.mode}].`, "success");
		} catch(err) {
			structureJson.value = "Error scanning document structure: " + err.message;
			if (outlineTreeContainer) outlineTreeContainer.innerHTML = `<div class="outline-error">Error scanning structure: ${err.message}</div>`;
			log("Error loading structure: " + err.message, "error");
		} finally {
			isScanning = false;
			isInternalQuery = false;
			lastInternalQueryTime = Date.now();
			if (outlineTreeContainer) {
				outlineTreeContainer.classList.remove('scanning-refreshed');
			}
			if (scanPending) {
				setTimeout(refreshDocStructureView, 50);
			}
		}
	}

	// Copy document JSON structure
	copyStructure.addEventListener('click', () => {
		const txt = structureJson.value;
		if (!txt || txt.startsWith("Scanning") || txt.startsWith("Error")) return;
		
		navigator.clipboard.writeText(txt).then(() => {
			const originalText = copyStructure.innerText;
			copyStructure.innerText = "Copied! ✓";
			setTimeout(() => {
				copyStructure.innerText = originalText;
			}, 1500);
			log("Copied structural document JSON to clipboard.", "success");
		}).catch(() => {
			log("Failed to copy JSON to clipboard.", "error");
		});
	});

	// Refresh document JSON structure
	refreshStructure.addEventListener('click', () => {
		refreshDocStructureView();
	});

	const cleanDefragmentBtn = document.getElementById('clean-defragment-btn');
	if (cleanDefragmentBtn) {
		cleanDefragmentBtn.addEventListener('click', async () => {
			cleanDefragmentBtn.disabled = true;
			const originalText = cleanDefragmentBtn.innerText;
			cleanDefragmentBtn.innerText = "Cleaning...";
			log("Starting manual document defragmentation layout cleanup...", "info");
			try {
				const mergeResult = await runDefragmentCommand();
				log(`Layout cleanup completed: merged ${mergeResult.mergedCount} lines.`, 'success');
				cleanDefragmentBtn.innerText = "Cleaned! ✓";
				setTimeout(() => {
					cleanDefragmentBtn.innerText = originalText;
					cleanDefragmentBtn.disabled = false;
				}, 1500);
				
				await refreshDocStructureView();
			} catch(e) {
				log(`Defragmentation failed: ${e.message}`, "error");
				cleanDefragmentBtn.innerText = originalText;
				cleanDefragmentBtn.disabled = false;
			}
		});
	}

	// Toggle view modes (Tree / JSON) in Outline
	if (toggleViewOutline && toggleViewJson && outlineTreeContainer && structureJson) {
		toggleViewOutline.addEventListener('click', () => {
			toggleViewOutline.classList.add('active');
			toggleViewJson.classList.remove('active');
			outlineTreeContainer.style.display = 'block';
			structureJson.style.display = 'none';
			copyStructure.style.display = 'none';
		});
		
		toggleViewJson.addEventListener('click', () => {
			toggleViewJson.classList.add('active');
			toggleViewOutline.classList.remove('active');
			outlineTreeContainer.style.display = 'none';
			structureJson.style.display = 'block';
			copyStructure.style.display = 'inline-block';
		});
	}

	// Session Checkpoint Snapshots
	saveCheckpointBtn.addEventListener('click', () => {
		saveCheckpoint();
	});

	async function saveCheckpoint() {
		log("Capturing active document snapshot...", "info");
		try {
			const docJSON = await serializeActiveContent();
			const snapshot = parseSerializedData(docJSON);
			const cp = {
				timestamp: new Date().toLocaleTimeString(),
				data: snapshot
			};
			checkpoints.push(cp);
			log(`Successfully saved session Checkpoint #${checkpoints.length}!`, 'success');
			renderCheckpointsUI();
		} catch (err) {
			log(`Failed to save checkpoint: ${err.message}`, 'error');
		}
	}

	async function saveAutoCheckpoint(promptText) {
		log("Capturing auto-checkpoint before execution...", "info");
		try {
			const docJSON = await serializeActiveContent();
			const snapshot = parseSerializedData(docJSON);
			const cp = {
				timestamp: new Date().toLocaleTimeString(),
				prompt: promptText,
				data: snapshot
			};
			checkpoints.push(cp);
			log(`Automatically saved checkpoint before prompt: "${promptText.substring(0, 20)}..."`, 'success');
			renderCheckpointsUI();
		} catch (err) {
			log(`Failed to save auto-checkpoint: ${err.message}`, 'error');
		}
	}

	function renderCheckpointsUI() {
		if (!checkpointsList) return;
		if (checkpoints.length === 0) {
			checkpointsList.innerHTML = `<div style="font-size: 11px; color: var(--text-secondary); text-align: center; padding: 8px;">No checkpoints saved yet.</div>`;
			return;
		}
		checkpointsList.innerHTML = '';
		checkpoints.forEach((cp, index) => {
			const item = document.createElement('div');
			item.className = 'checkpoint-item';
			const label = cp.prompt ? `Auto: "${cp.prompt.substring(0, 18)}${cp.prompt.length > 18 ? '...' : ''}"` : `Snapshot #${index + 1}`;
			item.innerHTML = `
				<div class="checkpoint-info" style="display: flex; flex-direction: column; gap: 2px;">
					<span class="checkpoint-label" style="font-weight: 600; font-size: 10.5px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;" title="${cp.prompt || ''}">${label}</span>
					<span class="checkpoint-time" style="font-size: 9px; color: var(--text-muted);">${cp.timestamp}</span>
				</div>
				<button class="checkpoint-restore-btn" data-index="${index}" style="padding: 4px 8px; font-size: 9.5px; border-radius: var(--border-radius-boxy);">Restore</button>
			`;
			checkpointsList.appendChild(item);
		});

		checkpointsList.querySelectorAll('.checkpoint-restore-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const idx = parseInt(btn.getAttribute('data-index'));
				restoreCheckpoint(idx);
			});
		});
	}

	async function restoreCheckpoint(index) {
		const cp = checkpoints[index];
		if (!cp) return;
		log(`Restoring document state to Checkpoint #${index + 1}...`, 'info');
		
		let restoreChanges = [];
		cp.data.sections.forEach(s => {
			s.elements.forEach(el => {
				if (el.type === "paragraph") {
					var props = {
						newText: el.text || ""
					};
					if (el.style) {
						if (el.style.fontName) props.fontName = el.style.fontName;
						if (el.style.fontSize) props.fontSize = el.style.fontSize;
						props.bold = !!el.style.bold;
						props.italic = !!el.style.italic;
						props.underline = !!el.style.underline;
						props.strikeout = !!el.style.strikeout;
						if (el.style.color) props.color = el.style.color;
						if (el.style.alignment) props.alignment = el.style.alignment;
						if (el.style.spacingAfter !== undefined) props.spacingAfter = el.style.spacingAfter;
						if (el.style.spacingBefore !== undefined) props.spacingBefore = el.style.spacingBefore;
						if (el.style.lineSpacing !== undefined) props.lineSpacing = el.style.lineSpacing;
						if (el.style.shading !== undefined) props.shading = el.style.shading;
					}
					restoreChanges.push({
						action: "modifyStyle",
						targetIndex: el.index,
						properties: props
					});
				}
			});
		});
		
		executeSequentialEdits(restoreChanges);
	}

	// Helper to find document element by its absolute logical index inside our parsed structure
	function findElementByIndex(index) {
		if (!cachedDocData || !cachedDocData.sections) return null;
		for (var s = 0; s < cachedDocData.sections.length; s++) {
			var elements = cachedDocData.sections[s].elements;
			if (!elements) continue;
			for (var e = 0; e < elements.length; e++) {
				if (elements[e].index === index) {
					return elements[e];
				}
			}
		}
		return null;
	}

	// Debounce helper to prevent performance lag during fast typing/movement
	function debounce(func, wait) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(function() {
				func.apply(context, args);
			}, wait);
		};
	}

	var debouncedRefresh = debounce(refreshDocStructureView, 250);

	// Dynamic theme handler to adapt to ONLYOFFICE editor light/dark mode
	window.Asc.plugin.onThemeChanged = function(theme) {
		if (window.Asc.plugin.onThemeChangedBase) {
			window.Asc.plugin.onThemeChangedBase(theme);
		}
		
		const isDark = theme.type === "dark" || theme.type === "contrast-dark";
		document.body.classList.toggle('theme-dark', isDark);
		document.body.classList.toggle('theme-light', !isDark);
		
		// Map any CSS variables passed from ONLYOFFICE to document root
		const root = document.documentElement;
		for (let key in theme) {
			if (key.startsWith('--')) {
				root.style.setProperty(key, theme[key]);
			} else {
				root.style.setProperty('--' + key, theme[key]);
			}
		}
		
		log('Theme adapted to OnlyOffice: ' + theme.type, 'info');
	};

	function loadReferenceTemplates() {
		fetch('reference_templates.json')
			.then(response => response.json())
			.then(data => {
				referenceTemplates = data;
				log('OneScript reference templates loaded successfully.', 'success');
			})
			.catch(err => {
				log('Failed to load reference templates: ' + err.message, 'warning');
			});
	}

	// Initialize ONLYOFFICE plugin hooks
	window.Asc.plugin.init = function() {
		loadLogFile();
		log('OneScript initialized.', 'success');
		loadSettings();
		loadReferenceTemplates();
		
		// Attach to selection change event to dynamically update the JSON structure view instantly!
		try {
			window.Asc.plugin.attachEvent("onSelectionChanged", function() {
				if (!isEditingAutonomously && !isInternalQuery && (Date.now() - lastInternalQueryTime > 400)) {
					debouncedRefresh();
				}
			});
		} catch(e) {
			log("Failed to attach onSelectionChanged: " + e.message, "warning");
		}

		try {
			window.Asc.plugin.attachEvent("onTargetPositionChanged", function() {
				if (!isEditingAutonomously && !isInternalQuery && (Date.now() - lastInternalQueryTime > 400)) {
					debouncedRefresh();
				}
			});
		} catch(e) {
			log("Failed to attach onTargetPositionChanged: " + e.message, "warning");
		}
		
		// Initial scan and toolbar load
		refreshDocStructureView();
	};

	// Fallback direct event assignments on the plugin object
	window.Asc.plugin.event_onSelectionChanged = function() {
		if (!isEditingAutonomously && !isInternalQuery && (Date.now() - lastInternalQueryTime > 400)) {
			debouncedRefresh();
		}
	};
	window.Asc.plugin.event_onTargetPositionChanged = function() {
		if (!isEditingAutonomously && !isInternalQuery && (Date.now() - lastInternalQueryTime > 400)) {
			debouncedRefresh();
		}
	};

	// Bind Undo / Redo toolbar events
	toolbarUndo.addEventListener('click', () => {
		window.Asc.plugin.executeMethod("Undo", [], () => {
			log("Executed document Undo successfully.", "info");
		});
	});

	toolbarRedo.addEventListener('click', () => {
		window.Asc.plugin.executeMethod("Redo", [], () => {
			log("Executed document Redo successfully.", "info");
		});
	});

	// Executive Summarization logic handler
	async function handleSummarizeClick() {
		const hasToken = localStorage.getItem('groq_copilot_key');
		
		if (!hasToken) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}

		appendChatMessage('user', 'Summarize active range');
		const aiMessage = appendChatMessage('ai', 'Summarizing...', 'text');
		const aiMessageBody = aiMessage.querySelector('.message-body');

		setLoading(true);

		try {
			const docJSON = await serializeActiveContent();
			const parsed = parseSerializedData(docJSON);
			log(`Summarizing active range [${parsed.mode === 'selection' ? 'Selection Only' : 'Entire Document'}]...`, 'info');

			const messages = [
				{
					role: 'system',
					content: "You are an expert executive summary agent. Analyze the provided text and document structure and return an extremely high-quality summary in 3 to 5 concise bullet points. Format the output directly as clean plain text bullet points starting with standard dash '-' prefixes. Do not return any JSON or markdown blocks."
				},
				{
					role: 'user',
					content: `Document data: ${JSON.stringify(parsed)}`
				}
			];

			const responseContent = await queryActiveLLM(messages, 0.2, false);
			activeSummaryContent = responseContent.trim();
			
			renderSummaryInMessage(aiMessageBody, activeSummaryContent);
			log('Executive summary compiled successfully by Groq AI!', 'success');
		} catch (err) {
			log(`Summarization failed: ${err.message}`, 'error');
			aiMessageBody.innerText = `Summarization failed: ${err.message}`;
		} finally {
			setLoading(false);
		}
	}

	// Chat Canvas Welcome view renderer
	function renderWelcomeScreen() {
		if (!chatHistoryContainer) return;
		chatHistoryContainer.innerHTML = `
			<div class="chat-welcome">
				<div class="welcome-icon">
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
				</div>
				<div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: var(--text-primary);">OneScript AI</div>
				<div style="margin-bottom: 12px; font-size: 11px; line-height: 1.45; color: var(--text-secondary); max-width: 250px;">Direct AI copilot for ONLYOFFICE. Highlight text to edit, format, translate, or write outline commands.</div>
				<div class="suggestion-container">
					<span class="chip chip-special" id="chip-summarize">Summarize Selection</span>
					<span class="chip" data-prompt="Format document: Georgia font, size 12pt, line-spacing 1.5, headers Crimson (#dc2626).">Modern Styling</span>
					<span class="chip" data-prompt="Insert an action item bulleted list: 'Schedule sync', 'Review logs', 'Run validation'.">Action Bullets</span>
					<span class="chip" data-prompt="Rewrite paragraph #2 to be much more professional, technical and concise.">Polished Text</span>
				</div>
			</div>
		`;
		
		const btnSummarize = document.getElementById('chip-summarize');
		if (btnSummarize) {
			btnSummarize.addEventListener('click', handleSummarizeClick);
		}
		
		chatHistoryContainer.querySelectorAll('.chip').forEach(chip => {
			if (chip.id === 'chip-summarize') return;
			chip.addEventListener('click', () => {
				promptInput.value = chip.getAttribute('data-prompt');
				promptInput.focus();
			});
		});
	}

	// Bind New Chat Clear action button
	const clearChatBtn = document.getElementById('clear-chat-btn');
	if (clearChatBtn) {
		clearChatBtn.addEventListener('click', () => {
			log("Clearing chat history and initiating a new session...", "info");
			renderWelcomeScreen();
		});
	}

	// Real-Time Stepper Progress Component Helpers
	function updateAgentStepper(aiMessageBody, steps) {
		aiMessageBody.innerHTML = '';
		const stepperDiv = document.createElement('div');
		stepperDiv.className = 'agent-stepper';
		
		steps.forEach((step, idx) => {
			const stepItem = document.createElement('div');
			stepItem.className = `stepper-item ${step.status}`;
			
			let statusIcon = '';
			if (step.status === 'done') {
				statusIcon = '✓';
			} else if (step.status === 'running') {
				statusIcon = '<div class="stepper-spinner"></div>';
			} else if (step.status === 'failed') {
				statusIcon = '✗';
			} else {
				statusIcon = idx + 1;
			}
			
			stepItem.innerHTML = `
				<div class="stepper-icon-wrap">
					<div class="stepper-icon">${statusIcon}</div>
				</div>
				<div class="stepper-content">
					<div class="stepper-title">${step.label}</div>
					${step.details ? `<div class="stepper-details">${step.details}</div>` : ''}
				</div>
			`;
			stepperDiv.appendChild(stepItem);
		});
		
		aiMessageBody.appendChild(stepperDiv);
	}

	function setStepperStep(idx, status, details) {
		if (!currentAgentSteps || !currentAgentSteps[idx]) return;
		currentAgentSteps[idx].status = status;
		if (details !== undefined) {
			currentAgentSteps[idx].details = details;
		}
		if (activeAiMessageBody) {
			updateAgentStepper(activeAiMessageBody, currentAgentSteps);
		}
	}

	// Agentic UI Initializer and Dynamic Renderers
	function initAgenticMessage(aiMessageBody) {
		aiMessageBody.innerHTML = `
			<div class="agent-status-bar" style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 600; color: var(--primary); margin-bottom: 8px;">
				<div class="stepper-spinner" style="width: 10px; height: 10px; border-width: 1.5px;"></div>
				<span>OneScript Agent Active...</span>
			</div>
			<div class="agent-thinking-card">
				<div class="agent-thinking-header">
					<span>Thought Process</span>
					<span class="chevron">▼</span>
				</div>
				<div class="agent-thinking-body">Initializing analysis...</div>
			</div>
			<div class="agent-step-logs"></div>
		`;

		// Bind accordion click listener to toggle thought process box
		const header = aiMessageBody.querySelector('.agent-thinking-header');
		const body = aiMessageBody.querySelector('.agent-thinking-body');
		const chevron = header.querySelector('.chevron');
		
		header.addEventListener('click', () => {
			const isExpanded = body.classList.contains('expanded');
			if (isExpanded) {
				body.classList.remove('expanded');
				header.classList.remove('expanded');
				chevron.innerText = '▼';
			} else {
				body.classList.add('expanded');
				header.classList.add('expanded');
				chevron.innerText = '▲';
			}
		});
	}

	function updateAgenticThought(aiMessageBody, thought) {
		const body = aiMessageBody.querySelector('.agent-thinking-body');
		const header = aiMessageBody.querySelector('.agent-thinking-header');
		const chevron = header ? header.querySelector('.chevron') : null;
		
		if (body) {
			body.innerText = thought;
			// Expand automatically on first real thought update
			if (!body.classList.contains('expanded')) {
				body.classList.add('expanded');
				if (header) header.classList.add('expanded');
				if (chevron) chevron.innerText = '▲';
			}
		}
	}

	function addAgenticLog(aiMessageBody, text, status = 'info') {
		const logsContainer = aiMessageBody.querySelector('.agent-step-logs');
		if (!logsContainer) return null;

		const logLine = document.createElement('div');
		logLine.className = 'agent-log-line';

		let icon = '<span style="color: var(--text-muted); font-size: 8px; margin-top: 4px;">●</span>';
		if (status === 'running') {
			icon = '<div class="stepper-spinner" style="width: 9px; height: 9px; border-width: 1.5px; border-top-color: var(--primary);"></div>';
		} else if (status === 'success') {
			icon = '<span style="color: #10b981; font-weight: bold;">✓</span>';
		} else if (status === 'failed') {
			icon = '<span style="color: #f43f5e; font-weight: bold;">✗</span>';
		} else if (status === 'think') {
			icon = '<span style="color: var(--primary); font-size: 8px; margin-top: 4px;">●</span>';
		} else if (status === 'apply') {
			icon = '<span style="color: #3b82f6; font-size: 8px; margin-top: 4px;">●</span>';
		} else if (status === 'check') {
			icon = '<span style="color: #10b981; font-size: 8px; margin-top: 4px;">●</span>';
		}

		logLine.innerHTML = `
			<div class="log-icon">${icon}</div>
			<div class="log-text">${text}</div>
		`;

		logsContainer.appendChild(logLine);
		chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
		return logLine;
	}

	function updateAgenticLog(logLineElement, text, status = 'info') {
		if (!logLineElement) return;
		const iconWrap = logLineElement.querySelector('.log-icon');
		const textWrap = logLineElement.querySelector('.log-text');
		
		if (textWrap && text !== undefined) {
			textWrap.innerText = text;
		}
		
		if (iconWrap) {
			let icon = '<span style="color: var(--text-muted); font-size: 8px; margin-top: 4px;">●</span>';
			if (status === 'running') {
				icon = '<div class="stepper-spinner" style="width: 9px; height: 9px; border-width: 1.5px; border-top-color: var(--primary);"></div>';
			} else if (status === 'success') {
				icon = '<span style="color: #10b981; font-weight: bold;">✓</span>';
			} else if (status === 'failed') {
				icon = '<span style="color: #f43f5e; font-weight: bold;">✗</span>';
			} else if (status === 'think') {
				icon = '<span style="color: var(--primary); font-size: 8px; margin-top: 4px;">●</span>';
			} else if (status === 'apply') {
				icon = '<span style="color: #3b82f6; font-size: 8px; margin-top: 4px;">●</span>';
			} else if (status === 'check') {
				icon = '<span style="color: #10b981; font-size: 8px; margin-top: 4px;">●</span>';
			}
			iconWrap.innerHTML = icon;
		}
	}

	function addAgenticSubAction(logLineElement, text, success = true) {
		let subActionsContainer = logLineElement.querySelector('.agent-sub-actions');
		if (!subActionsContainer) {
			subActionsContainer = document.createElement('div');
			subActionsContainer.className = 'agent-sub-actions';
			logLineElement.appendChild(subActionsContainer);
		}

		const subActionLine = document.createElement('div');
		subActionLine.className = `agent-sub-action-line ${success ? 'success' : 'failed'}`;
		subActionLine.innerHTML = `
			<span>${success ? '<span style="color: #10b981; font-weight: bold;">✓</span>' : '<span style="color: #f43f5e; font-weight: bold;">✗</span>'}</span>
			<span>${text}</span>
		`;

		subActionsContainer.appendChild(subActionLine);
		chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
		return subActionLine;
	}

	function setAgenticComplete(aiMessageBody, success = true) {
		const statusBar = aiMessageBody.querySelector('.agent-status-bar');
		if (statusBar) {
			if (success) {
				statusBar.innerHTML = `
					<span style="color: #10b981; font-size: 12px; margin-right: 4px;">✓</span>
					<span style="color: #10b981;">Agent Task Completed</span>
				`;
			} else {
				statusBar.innerHTML = `
					<span style="color: #f43f5e; font-size: 12px; margin-right: 4px;">✗</span>
					<span style="color: #f43f5e;">Agent Task Failed</span>
				`;
			}
		}
		
		// Collapse thought process at completion to keep chat clean
		const body = aiMessageBody.querySelector('.agent-thinking-body');
		const header = aiMessageBody.querySelector('.agent-thinking-header');
		const chevron = header ? header.querySelector('.chevron') : null;
		if (body && body.classList.contains('expanded')) {
			body.classList.remove('expanded');
			if (header) header.classList.remove('expanded');
			if (chevron) chevron.innerText = '▼';
		}
	}

	// Click run button (Refactored Intent-routed Context-aware Pipeline)
	executeBtn.addEventListener('click', async () => {
		const provider = localStorage.getItem('onescript_provider') || 'groq';
		const hasToken = localStorage.getItem('onescript_api_key') || localStorage.getItem('groq_copilot_key');
		const prompt = promptInput.value.trim();

		if (provider === 'groq' && !hasToken) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}
		if (!prompt) {
			log('Error: Prompt cannot be empty.', 'error');
			return;
		}

		// Append user message and clear input
		appendChatMessage('user', prompt);
		promptInput.value = '';

		// Append AI placeholder
		const aiMessage = appendChatMessage('ai', 'Initializing...', 'text');
		activeAiMessageBody = aiMessage.querySelector('.message-body');

		// Capture snapshot before executing
		try {
			await saveAutoCheckpoint(prompt);
		} catch(e) {
			log(`Could not capture auto-checkpoint: ${e.message}`, 'warning');
		}

		// Initialize Agentic UI Layout
		initAgenticMessage(activeAiMessageBody);

		// Initialize Telemetry Log
		lastExecutionDebugData = {
			timestamp: new Date().toLocaleString(),
			intent: "Routing...",
			serializationMode: "Determining...",
			userPrompt: prompt,
			systemPrompt: null,
			fullUserPrompt: null,
			rawResponse: null,
			parsedPlans: null,
			stateBefore: [],
			stateAfter: [],
			status: "Running (Routing Intent & Extracting Context)..."
		};
		if (typeof updateDebugViewer === 'function') updateDebugViewer();

		setLoading(true);

		try {
			// Direct local handler for Defragmentation / Layout cleanup requests
			const lowerPrompt = prompt.toLowerCase();
			if (lowerPrompt.indexOf("defragment") !== -1 || 
			    lowerPrompt.indexOf("merge line") !== -1 || 
			    lowerPrompt.indexOf("fix broken line") !== -1 || 
			    lowerPrompt.indexOf("join line") !== -1 || 
			    lowerPrompt.indexOf("clean layout") !== -1 || 
			    lowerPrompt.indexOf("restructure paragraph") !== -1) {
				
				addAgenticLog(activeAiMessageBody, "Executing native layout defragmentation...", "running");
				const mergeResult = await runDefragmentCommand();
				addAgenticLog(activeAiMessageBody, `Merged ${mergeResult.mergedCount} fragmented lines into continuous paragraphs.`, "success");
				setAgenticComplete(activeAiMessageBody, true);
				
				activeAiMessageBody.innerHTML += `
					<div class="stepper-success-message" style="padding: 10px; border-radius: 6px; background: var(--success-glow); border: 1px solid var(--success); font-size: 11px; margin-top: 10px;">
						<span style="font-weight: 600; color: var(--success);">Success!</span> Natively defragmented document layout: merged <strong>${mergeResult.mergedCount}</strong> fragmented lines.
					</div>
				`;
				
				log(`Successfully merged ${mergeResult.mergedCount} lines.`, 'success');
				
				setTimeout(async () => {
					if (typeof refreshDocStructureView === 'function') {
						await refreshDocStructureView();
					}
				}, 100);
				
				return;
			}
			// LAYER 1: Intent Router
			const logIntent = addAgenticLog(activeAiMessageBody, "Classifying request intent...", "running");
			const intent = await routeIntent(prompt);
			lastExecutionDebugData.intent = intent;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();
			updateAgenticLog(logIntent, `Classified user request intent: [${intent.toUpperCase()}]`, "success");

			if (intent === INTENTS.CHAT) {
				const logChat = addAgenticLog(activeAiMessageBody, "Formulating response...", "running");
				
				const activeModel = localStorage.getItem('onescript_model') || localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
				const chatMessages = [
					{ 
						role: 'system', 
						content: "You are a helpful, professional assistant for ONLYOFFICE document editors. The user is greeting you or asking a general question. Respond directly, professionally, and concisely without returning any JSON or code. Do not format as JSON." 
					},
					{ role: 'user', content: prompt }
				];
				
				const chatRes = await queryActiveLLM(chatMessages, 0.7, false);
				
				const thinkingCard = activeAiMessageBody.querySelector('.agent-thinking-card');
				if (thinkingCard) thinkingCard.remove();
				
				if (logChat) logChat.remove();
				if (logIntent) logIntent.remove();
				
				activeAiMessageBody.innerHTML += `
					<div class="chat-direct-response" style="line-height: 1.45; font-size: 11.5px; color: var(--text-primary); margin-top: 6px; animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;">
						${chatRes.replace(/\n/g, '<br>')}
					</div>
				`;
				
				setAgenticComplete(activeAiMessageBody, true);
				setLoading(false);
				return;
			}

			// LAYER 2: Context Builder Serialization mode determination
			const logCompile = addAgenticLog(activeAiMessageBody, "Compiling and serializing document ranges...", "running");
			let serializationMode = "minimal";
			if (intent === INTENTS.FORMAT || intent === INTENTS.INSERT_CONTENT || intent === INTENTS.DELETE_CONTENT || intent === INTENTS.REWRITE) {
				serializationMode = "medium";
			} else if (intent === INTENTS.CREATE_DOCUMENT || intent === INTENTS.RESTRUCTURE || intent === INTENTS.ANALYZE) {
				serializationMode = "full";
			}
			lastExecutionDebugData.serializationMode = serializationMode;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

			log(`[CONTEXT_BUILDER] Selected serialization mode: [${serializationMode.toUpperCase()}] for routed intent [${intent.toUpperCase()}].`, 'info');
			const docJSON = await serializeActiveContent(serializationMode);
			cachedDocData = parseSerializedData(docJSON);
			
			lastExecutionDebugData.stateBefore = cachedDocData.sections || [];
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

			const totalElements = cachedDocData.sections ? cachedDocData.sections.reduce((acc, s) => acc + (s.elements ? s.elements.length : 0), 0) : 0;
			const docMeta = cachedDocData.metadata || {};
			log(`[CONTEXT_BUILDER] Serialized ${totalElements} smart elements out of ${docMeta.totalElements || 0} total elements (Compaction: ${Math.round((totalElements / (docMeta.totalElements || 1)) * 100)}%). cursorIndex: ${docMeta.cursorIndex !== undefined ? docMeta.cursorIndex : 'N/A'}.`, 'success');

			if (totalElements === 0 && intent !== INTENTS.CREATE_DOCUMENT) {
				log('Error: Selection range or document is empty.', 'error');
				updateAgenticLog(logCompile, "Selection range or document is empty.", "failed");
				activeAiMessageBody.innerHTML += '<div style="color: var(--error); margin-top: 8px;">Error: Selection range or document is empty.</div>';
				lastExecutionDebugData.status = "Failed: Selection range or document is empty.";
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				setAgenticComplete(activeAiMessageBody, false);
				setLoading(false);
				return;
			}

			updateAgenticLog(logCompile, `Compacted and parsed ${totalElements} active document elements.`, "success");
			
			let iteration = 0;
			const maxIterations = 5;
			let history = [];
			let isDone = false;
			let modifications = [];
			proposedChanges = [];
			
			while (iteration < maxIterations && !isDone) {
				iteration++;
				const activeModel = localStorage.getItem('onescript_model') || localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
				
				const logThink = addAgenticLog(activeAiMessageBody, `[Step ${iteration}] Querying agent planner via ${activeModel}...`, "running");
				
				const aiResponse = await queryPlannerLLM(cachedDocData, prompt, intent, history);
				lastExecutionDebugData.rawResponse = aiResponse;
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				
				let parsedRes;
				try {
					let clean = aiResponse.trim();
					if (clean.startsWith('```')) {
						clean = clean.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
					}
					parsedRes = JSON.parse(clean);
				} catch(e) {
					log(`Failed to parse agent JSON: ${e.message}`, 'error');
					updateAgenticLog(logThink, `[Step ${iteration}] Failed to parse planner response.`, "failed");
					throw new Error("Could not parse a valid JSON action script from the agent's response.");
				}
				
				const thought = parsedRes.thought || "Thinking...";
				const stepPlans = parsedRes.plans || [];
				isDone = !!parsedRes.done;
				
				log(`Agent Thought (Iteration ${iteration}): "${thought}"`, 'info');
				updateAgenticThought(activeAiMessageBody, thought);
				
				updateAgenticLog(logThink, `[Step ${iteration}] Thought formulated.`, "success");
				
				if (isDone || stepPlans.length === 0) {
					if (logThink) logThink.remove();
					addAgenticLog(activeAiMessageBody, `Agent determined all changes are complete.`, "success");
					break;
				}
				
				log(`Agent proposed ${stepPlans.length} actions in Iteration ${iteration}.`, 'info');
				const logApply = addAgenticLog(activeAiMessageBody, `Applying and verifying ${stepPlans.length} proposed edits...`, "running");
				
				isEditingAutonomously = true;
				const outcomes = await executeSingleStepEdits(stepPlans, modifications);
				isEditingAutonomously = false;
				
				updateAgenticLog(logApply, `[Step ${iteration}] Finished applying proposed edits:`, "success");
				
				outcomes.forEach(out => {
					const desc = `${out.action} on paragraph #${out.targetIndex}`;
					addAgenticSubAction(logApply, `${desc}: ${out.reason}`, out.success);
				});
				
				// Record step in history
				history.push({
					iteration: iteration,
					thought: thought,
					plans: stepPlans,
					outcomes: outcomes
				});
				
				proposedChanges = proposedChanges.concat(stepPlans);
				
				// Re-serialize content for next iteration step to let the agent inspect actual layout
				const docJSON = await serializeActiveContent(serializationMode);
				cachedDocData = parseSerializedData(docJSON);
				
				await new Promise(r => setTimeout(r, 200));
			}
			
			setAgenticComplete(activeAiMessageBody, true);
			
			if (proposedChanges.length === 0) {
				log('Analysis complete: No logical changes suggested for this request.', 'warning');
				activeAiMessageBody.innerHTML += '<div style="margin-top: 10px; font-size: 11px;">No document edits were necessary for this request.</div>';
				lastExecutionDebugData.status = "No changes suggested.";
			} else {
				log(`Agent loop completed successfully. Total actions executed: ${proposedChanges.length}`, 'success');
				
				executeBtn.disabled = false;
				lastInternalQueryTime = Date.now();
				appliedChangesCount = proposedChanges.length;
				undoAiBtn.style.display = 'inline-flex';
				
				renderChatPreview(activeAiMessageBody, proposedChanges, true);
				
				lastExecutionDebugData.status = "Success (Iterative agent loop executed and verified successfully!)";
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				
				setTimeout(() => {
					refreshDocStructureView();
				}, 200);
			}
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

		} catch (err) {
			log(`Execution Error: ${err.message}`, 'error');
			addAgenticLog(activeAiMessageBody, `Error during execution: ${err.message}`, "failed");
			setAgenticComplete(activeAiMessageBody, false);
			
			lastExecutionDebugData.status = "Failed: " + err.message;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();
			console.error(err);
		} finally {
			setLoading(false);
		}
	});

	// Bind transaction-level Undo AI button
	undoAiBtn.addEventListener('click', () => {
		if (appliedChangesCount <= 0) return;
		undoAiBtn.disabled = true;
		log(`Undoing last AI transaction (${appliedChangesCount} operations)...`, 'info');
		
		const count = appliedChangesCount;
		appliedChangesCount = 0;
		undoAiBtn.style.display = 'none';
		undoAiBtn.disabled = false;
		
		appendChatMessage('user', 'Undo last AI action');
		const aiMessage = appendChatMessage('ai', 'Reverting document changes...', 'text');
		const aiMessageBody = aiMessage.querySelector('.message-body');
		
		performMultipleUndos(count, () => {
			log('Undo transaction complete!', 'success');
			aiMessageBody.innerHTML = '<span style="color: var(--success); font-weight: 600;">Document successfully restored to pre-AI state.</span>';
			debouncedRefresh();
		});
	});

	window.Asc.plugin.button = function(id) {
		this.executeCommand("close", "");
	};

	function setLoading(loading) {
		if (loading) {
			executeBtn.classList.add('loading');
			executeBtn.disabled = true;
		} else {
			executeBtn.classList.remove('loading');
			executeBtn.disabled = false;
		}
	}

	// Helper to extract runs with nested bold/italic/color/font properties inside any paragraph
	function serializeRuns(oElement) {
		var runsData = [];
		try {
			var aRuns = oElement.GetElements();
			if (aRuns && aRuns.length > 0) {
				for (var r = 0; r < aRuns.length; r++) {
					var oRun = aRuns[r];
					if (oRun && oRun.GetClassType() === "run") {
						var rText = oRun.GetText() || "";
						if (rText === "") continue;
						
						var rFontName = "Calibri";
						var rFontSize = 22;
						var rBold = false;
						var rItalic = false;
						var rColor = "#000000";
						
						try {
							if (typeof oRun.GetFontFamily === "function") {
								rFontName = oRun.GetFontFamily() || rFontName;
							} else if (typeof oRun.GetFontNames === "function") {
								var names = oRun.GetFontNames();
								if (names && names.length > 0) rFontName = names[0] || rFontName;
							} else if (oRun.GetFontName) {
								rFontName = oRun.GetFontName() || rFontName;
							}
						} catch(e) {}
						try { if (oRun.GetFontSize) rFontSize = oRun.GetFontSize() || rFontSize; } catch(e) {}
						try { if (oRun.GetBold) rBold = oRun.GetBold() || rBold; } catch(e) {}
						try { if (oRun.GetItalic) rItalic = oRun.GetItalic() || rItalic; } catch(e) {}
						try {
							if (oRun.GetColor) {
								var c = oRun.GetColor();
								if (c && c.GetHex) {
									var hexVal = c.GetHex();
									if (hexVal) rColor = hexVal;
								}
							}
						} catch(e) {}
						
						runsData.push({
							text: rText,
							style: {
								fontName: rFontName,
								fontSize: rFontSize / 2,
								bold: rBold,
								italic: rItalic,
								color: rColor
							}
						});
					}
				}
			}
		} catch(e) {}
		return runsData;
	}

	function runDefragmentCommand() {
		return new Promise((resolve) => {
			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var count = oDocument.GetElementsCount();
				var mergedCount = 0;
				
				for (var i = count - 2; i >= 0; i--) {
					try {
						var pCurrent = oDocument.GetElement(i);
						var pNext = oDocument.GetElement(i + 1);
						
						if (pCurrent && pNext && pCurrent.GetClassType() === "paragraph" && pNext.GetClassType() === "paragraph") {
							var textCurrent = pCurrent.GetText() || "";
							var textNext = pNext.GetText() || "";
							
							var cleanCurrent = textCurrent.trim();
							var cleanNext = textNext.trim();
							
							if (cleanCurrent.length > 0 && cleanNext.length > 0) {
								var lastChar = cleanCurrent.charAt(cleanCurrent.length - 1);
								var isSentenceEnd = (lastChar === '.' || lastChar === '?' || lastChar === '!' || lastChar === ':');
								
								var isNextHeading = false;
								if (/^[A-Z]\.\s+/.test(cleanNext) || /^[I|V|X]+\.\s+/.test(cleanNext) || /^\d+(\.\d+)*\.?\s+/.test(cleanNext) || cleanNext.startsWith("•") || cleanNext.startsWith("-")) {
									isNextHeading = true;
								}
								
								if (!isSentenceEnd && !isNextHeading) {
									var firstChar = cleanNext.charAt(0);
									if (lastChar !== ' ' && lastChar !== '\t' && firstChar !== ' ' && firstChar !== '\t') {
										pCurrent.AddText(" ");
									}
									
									var runCount = pNext.GetElementsCount();
									if (runCount > 0) {
										for (var r = 0; r < runCount; r++) {
											var oRun = pNext.GetElement(r);
											if (oRun && oRun.GetClassType() === "run") {
												var rText = oRun.GetText() || "";
												var newRun = pCurrent.AddText(rText);
												try {
													var tp = oRun.GetTextPr();
													if (tp && newRun.SetTextPr) newRun.SetTextPr(tp);
												} catch(eRunStyle) {}
											}
										}
									} else {
										pCurrent.AddText(textNext);
									}
									
									oDocument.RemoveElement(i + 1);
									mergedCount++;
								}
							}
						}
					} catch(eLoop) {}
				}
				return { mergedCount: mergedCount };
			}, false, true, function(res) {
				resolve(res || { mergedCount: 0 });
			});
		});
	}

	// ==========================================
	// ARCHITECTURAL LAYER IMPLEMENTATIONS
	// ==========================================
	// LAYER 1: Intent Router Layer
	async function routeIntent(prompt) {
		log(`Routing user intent for prompt: "${prompt.substring(0, 40)}..."`, 'info');
		
		const cleanPrompt = prompt.toLowerCase().trim();
		// Intercept basic greetings, chat-like questions, or system diagnostics locally
		if (cleanPrompt === 'hi' || cleanPrompt === 'hello' || cleanPrompt === 'hey' || cleanPrompt === 'greetings' ||
			cleanPrompt === 'help' || cleanPrompt === 'who are you' || cleanPrompt.includes('what is this') || 
			cleanPrompt === 'what can you do' || cleanPrompt.startsWith('how to') || cleanPrompt.startsWith('how do i')) {
			log(`Intercepted general conversational chat query. Routing to [CHAT] intent directly.`, 'success');
			return INTENTS.CHAT;
		}

		const systemMessage = `You are an Intent Router. Your job is to classify the user's document editing request into exactly one of the following intents:
- "chat": Simple greetings, social questions, introductions, help requests, general chit-chat, or questions that do NOT ask to edit, analyze, format, or restructure the document.
- "rewrite": Rewrite, rephrase, change tone, expand, shorten, professionalize text.
- "summarize": Create summary, bullets, overview of selection/document.
- "translate": Translate text into another language.
- "format": Change font, size, bold, italic, color, alignment, spacing, indentation, shading. No rewriting.
- "create_document": Generate a new document, write essays, letters, articles, full sections.
- "insert_content": Insert a new paragraph, table, or content at a location.
- "delete_content": Delete or remove paragraphs, sentences, or tables.
- "restructure": Reorganize, sort headings, change document flow or page layout/margins.
- "analyze": Analyze grammar, spelling, structure, style issues, readability.

Respond ONLY with a valid JSON object containing a single key "intent" mapped to one of the following exact string values: "chat", "rewrite", "summarize", "translate", "format", "create_document", "insert_content", "delete_content", "restructure", "analyze".
Do not include markdown packaging.
Example response: {"intent": "chat"}`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: `Request: "${prompt}"` }
		];

		try {
			const res = await queryActiveLLM(messages, 0.0, true);
			let clean = res.trim();
			if (clean.startsWith('```')) {
				clean = clean.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
			}
			const parsed = JSON.parse(clean);
			if (parsed && parsed.intent && Object.values(INTENTS).includes(parsed.intent)) {
				log(`Intent classified successfully: [${parsed.intent.toUpperCase()}]`, 'success');
				return parsed.intent;
			}
		} catch (e) {
			log(`Intent routing error: ${e.message}. Defaulting to "rewrite".`, 'warning');
		}
		return INTENTS.REWRITE;
	}

	async function queryPlannerLLM(docData, prompt, intent, history = []) {
		const ruleset = RULES[intent] || RULES.rewrite;
		
		var templatesContext = "";
		if (referenceTemplates && referenceTemplates.templates) {
			templatesContext = "\n\nREFERENCE DESIGN TEMPLATES (Use these guidelines/defaults to match styles appropriately):\n" + JSON.stringify(referenceTemplates.templates, null, 2);
		}

		const systemMessage = `You are an autonomous document editor agent operating in an iterative "think, apply, check, rethink" loop.
Your task is to analyze the document context, the user's request, and the history of actions applied so far, and determine the single next logical action step to bring the document closer to the user's goal.

In each iteration, you must output a valid JSON containing:
1. "thought": A detailed explanation of your analysis, what needs to be changed next, and why.
2. "plans": An array of one or more standard plans representing the next immediate changes to apply.
3. "done": A boolean flag. Set this to true ONLY when all parts of the user request have been fully completed.

You must NEVER generate OnlyOffice API commands directly (like Select(), AddElement(), etc.).
You must ONLY output valid JSON matching this schema:
{
  "thought": "A detailed explanation of the analysis and next edits...",
  "plans": [
    {
      "action": "rewrite" | "change_font" | "change_color" | "create_paragraph" | "delete_paragraph" | "paste_html" | "make_list" | "change_indent" | "table_action" | "change_page",
      "targetIndex": 5, // index of target paragraph or table, or -1 for global/selection layout actions
      "subAction": "create" | "add_row" | "add_column" | "delete_row" | "delete_column" | "merge_cells" | "cell_shading" | "cell_borders" | "set_cell_text", // ONLY for "table_action"
      "properties": {
        "newText": "Rewritten or newly created plain text here...",
        "html": "<p style='font-family:Arial;font-size:12pt;'>Styled HTML content for paste_html...</p>",
        "fontName": "Georgia",
        "fontSize": 12, // in standard points (e.g., 12 for 12pt)
        "bold": true,
        "italic": false,
        "underline": true,
        "strikeout": false,
        "doubleStrikeout": false,
        "color": "#1e40af",
        "highlight": "yellow",
        "alignment": "justify" | "left" | "center" | "right",
        "spacingBefore": 120, // in dxa
        "spacingAfter": 120, // in dxa
        "lineSpacing": 1.15,
        "shading": "#f3f4f6",
        
        // List styling properties (applicable for make_list AND create_paragraph):
        "listType": "bullet" | "numbered",
        "style": "bullet" | "decimal" | "lowerRoman" | "upperRoman" | "lowerLetter" | "upperLetter",
        "level": 0, // nesting level 0 to 8
        "formatString": "•" | "%1." | "%1)" | "%1.%2.",
        
        // Indentation properties (applicable for change_indent AND create_paragraph):
        "indLeft": 720, // in dxa/twips (1440 = 1 inch, 720 = 0.5 inch)
        "indRight": 720,
        "indFirstLine": 360,
        
        // Layout/Page settings:
        "pageOrientation": "portrait" | "landscape",
        "pageWidth": 12240, // in dxa
        "pageHeight": 15840, // in dxa
        "marginLeft": 1440, // in dxa
        "marginRight": 1440, // in dxa
        "marginTop": 1440, // in dxa
        "marginBottom": 1440, // in dxa
        "columnsCount": 2,
        
        // Table properties (ONLY for table_action):
        "rows": 3, // for subAction 'create'
        "cols": 3, // for subAction 'create'
        "rowIndex": 0, // for add_row or delete_row
        "colIndex": 0, // for delete_column
        "before": true, // for add_row
        "cells": [[0, 0], [0, 1]], // coordinates [row, col] for merge_cells, cell_shading, cell_borders, or set_cell_text
        "color": "#eff6ff", // shading color for cell_shading
        "borderStyle": "single" | "double" | "dotted" | "dashed" | "none", // for cell_borders
        "borderSize": 8, // in eighths of a point (e.g. 8 for 1pt) - for cell_borders
        "borderColor": "#000000", // hex color - for cell_borders
        "cellData": [["header1", "header2"], ["val1", "val2"]] // 2D array of strings to populate table cells directly on subAction 'create'
      }
    }
  ],
  "done": false // Set to true ONLY when the user's request has been fully completed.
}

CRITICAL FORMATTING & ACTION RULES:
1. You MUST ONLY use the allowed actions: "rewrite", "change_font", "change_color", "create_paragraph", "delete_paragraph", "paste_html", "make_list", "change_indent", "table_action", "change_page". Do NOT invent or use other actions like "move_section", "rename_section", "move_paragraph", etc.
2. To move or reorganize a section, use a sequence of "delete_paragraph" actions for the original paragraphs, and "paste_html" or "create_paragraph" actions to recreate/insert them at the destination index.
3. When creating/inserting new paragraphs or sections, you MUST style them explicitly (via properties like fontName, fontSize, color, bold, alignment, spacing) to match the surrounding paragraphs in the document context. Do not leave styling default/blank.
4. To format, highlight, color, bold, or italicize specific words or phrases (rather than the entire paragraph), you MUST use the "rewrite" action for that paragraph and wrap the targeted words in HTML tags inside the "newText" property (e.g., use <mark>IEEE</mark> to highlight the word IEEE, <b>word</b> for bold, <i>word</i> for italic, or <span style="background-color:yellow;">word</span>). Do not use paragraph-level properties if you only want to style specific words, as that would format the entire paragraph text.

CRITICAL CARET/CURSOR ANCHORING RULES:
1. If the user request asks to add, insert, generate, or create content (such as paragraphs, headings, lists, or tables) and a valid "cursorIndex" (>= 0) is specified in the document metadata under "metadata.cursorIndex", you MUST default to inserting/creating the content directly at or after the "cursorIndex" (i.e., targetIndex = cursorIndex).
2. If the user explicitly asks to put content "where the mouse is", "where the cursor is", "under the cursor", "at the cursor", "at my selection", or similar, you MUST target the "cursorIndex" for the insertion action.
3. Only override this behavior if the user specifies an explicit alternative location (e.g., "in last of the document" or "at the very beginning").

${templatesContext}

Specific rules for this intent [${intent.toUpperCase()}]:
${ruleset.instructions}

Return valid JSON only. Do not include markdown code block formatting (like \`\`\`json).`;

		const historyText = history.length > 0 
			? `HISTORY OF ACTIONS EXECUTED SO FAR IN THIS SESSION:\n${JSON.stringify(history, null, 2)}` 
			: "HISTORY OF ACTIONS EXECUTED SO FAR IN THIS SESSION:\nNo actions executed yet. This is the first iteration.";

		const userMessage = `Current Document Context (${docData.targetMode} mode):
${JSON.stringify(docData, null, 2)}

${historyText}

User Request:
"${prompt}"`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: userMessage }
		];

		lastExecutionDebugData.systemPrompt = systemMessage;
		lastExecutionDebugData.fullUserPrompt = userMessage;
		if (typeof updateDebugViewer === 'function') updateDebugViewer();

		return await queryActiveLLM(messages, 0.1, true);
	}

	// LAYER 6: Verification Engine helpers
	function captureElementState(targetIndex) {
		return new Promise((resolve) => {
			window.Asc.scope.targetIndex = targetIndex;
			window.Asc.plugin.callCommand(function() {
				var targetIndex = Asc.scope.targetIndex;
				var oDocument = Api.GetDocument();
				var count = oDocument.GetElementsCount();
				if (count > 0) {
					if (targetIndex >= count) targetIndex = count - 1;
					if (targetIndex < 0) targetIndex = 0;
				} else {
					return null;
				}
				var oParagraph = oDocument.GetElement(targetIndex);
				if (!oParagraph || oParagraph.GetClassType() !== "paragraph") {
					return { type: "other", text: "", elementsCount: count };
				}
				var text = oParagraph.GetText() || "";
				var fontName = "Calibri";
				var fontSize = 22;
				var bold = false;
				var underline = false;
				
				try {
					var runCount = oParagraph.GetElementsCount();
					if (runCount > 0) {
						var firstRun = oParagraph.GetElement(0);
						if (firstRun) {
							// 1. Direct from Run properties
							try {
								if (typeof firstRun.GetFontFamily === "function") {
									var family = firstRun.GetFontFamily();
									if (family) fontName = family;
								}
							} catch(e) {}
							try {
								if ((fontName === "Calibri" || !fontName) && typeof firstRun.GetFontNames === "function") {
									var names = firstRun.GetFontNames();
									if (names && names.length > 0) fontName = names[0] || fontName;
								}
							} catch(e) {}
							try {
								if ((fontName === "Calibri" || !fontName) && typeof firstRun.GetFontName === "function") {
									fontName = firstRun.GetFontName() || fontName;
								}
							} catch(e) {}
							try { if (typeof firstRun.GetFontSize === "function") fontSize = firstRun.GetFontSize() || fontSize; } catch(e) {}
							try { if (typeof firstRun.GetBold === "function") bold = !!firstRun.GetBold(); } catch(e) {}
							try { if (typeof firstRun.GetUnderline === "function") underline = !!firstRun.GetUnderline(); } catch(e) {}

							// 2. From Text properties (TextPr)
							try {
								if (typeof firstRun.GetTextPr === "function") {
									var tp = firstRun.GetTextPr();
									if (tp) {
										if (fontName === "Calibri" && typeof tp.GetFontFamily === "function") fontName = tp.GetFontFamily() || fontName;
										if (!fontSize && typeof tp.GetFontSize === "function") fontSize = tp.GetFontSize() || fontSize;
										if (!bold && typeof tp.GetBold === "function") bold = !!tp.GetBold();
										if (!underline && typeof tp.GetUnderline === "function") underline = !!tp.GetUnderline();
									}
								}
							} catch(e) {}
						}
					}
					
					// 3. From Paragraph Range properties (captures local overrides on the text segment)
					try {
						if ((fontName === "Calibri" || !fontName || !fontSize) && typeof oParagraph.GetRange === "function") {
							var oRange = oParagraph.GetRange();
							if (oRange && typeof oRange.GetTextPr === "function") {
								var rTp = oRange.GetTextPr();
								if (rTp) {
									if ((fontName === "Calibri" || !fontName) && typeof rTp.GetFontFamily === "function") {
										var rFamily = rTp.GetFontFamily();
										if (rFamily) fontName = rFamily;
									}
									if ((fontName === "Calibri" || !fontName) && typeof rTp.GetFontName === "function") {
										var rName = rTp.GetFontName();
										if (rName) fontName = rName;
									}
									if (!fontSize && typeof rTp.GetFontSize === "function") {
										var rSize = rTp.GetFontSize();
										if (rSize) fontSize = rSize;
									}
									if (!bold && typeof rTp.GetBold === "function") {
										bold = !!rTp.GetBold();
									}
									if (!underline && typeof rTp.GetUnderline === "function") {
										underline = !!rTp.GetUnderline();
									}
								}
							}
						}
					} catch(eRange) {}

					if ((fontName === "Calibri" || !fontName || !fontSize) && typeof oParagraph.GetTextPr === "function") {
						try {
							var pTp = oParagraph.GetTextPr();
							if (pTp) {
								if ((fontName === "Calibri" || !fontName) && typeof pTp.GetFontFamily === "function") {
									var pFamily = pTp.GetFontFamily();
									if (pFamily) fontName = pFamily;
								}
								if (!fontSize && typeof pTp.GetFontSize === "function") {
									var pSize = pTp.GetFontSize();
									if (pSize) fontSize = pSize;
								}
								if (!bold && typeof pTp.GetBold === "function") {
									bold = !!pTp.GetBold();
								}
								if (!underline && typeof pTp.GetUnderline === "function") {
									underline = !!pTp.GetUnderline();
								}
							}
						} catch(e) {}
					}
				} catch(e) {}

				return {
					type: "paragraph",
					text: text,
					fontName: fontName,
					fontSize: fontSize / 2, // convert to standard points
					bold: bold,
					underline: underline,
					elementsCount: count
				};
			}, false, true, function(res) {
				resolve(res);
			});
		});
	}

	function verifyChange(change, beforeState, afterState, editResult) {
		const actionName = change.action;
		const props = change.properties || {};

		if (actionName === 'delete_paragraph' || actionName === 'deleteParagraph') {
			if (editResult && editResult.delta < 0) {
				return { success: true };
			}
			if (!beforeState) return { success: true }; 
			if (!afterState) return { success: true }; 
			if (afterState.elementsCount < beforeState.elementsCount) {
				return { success: true };
			}
			return { success: false, reason: "Paragraph count did not decrease after deletion" };
		}

		if (actionName === 'create_paragraph' || actionName === 'createParagraph') {
			if (editResult && editResult.delta > 0) {
				return { success: true };
			}
			if (afterState && afterState.elementsCount > (beforeState ? beforeState.elementsCount : 0)) {
				return { success: true };
			}
			return { success: false, reason: "Paragraph count did not increase after creation" };
		}

		if (actionName === 'paste_html' || actionName === 'pasteHTML') {
			if (editResult && editResult.delta > 0) {
				return { success: true };
			}
			if (afterState && (afterState.text !== (beforeState ? beforeState.text : "") || afterState.elementsCount > (beforeState ? beforeState.elementsCount : 0))) {
				return { success: true };
			}
			return { success: false, reason: "No new content detected after HTML paste" };
		}

		if (actionName === 'make_list' || actionName === 'makeList' ||
		    actionName === 'change_indent' || actionName === 'changeIndent' ||
		    actionName === 'table_action' || actionName === 'tableAction' ||
		    actionName === 'change_page' || actionName === 'changePage') {
			return { success: true };
		}

		if (afterState) {
			if (props.newText !== undefined && afterState.text !== props.newText) {
				const cleanAfter = afterState.text.replace(/[\s\r\n\t]+/g, '');
				const cleanExpected = props.newText.replace(/(<([^>]+)>)/gi, "").replace(/[\s\r\n\t]+/g, ''); 
				if (cleanAfter.indexOf(cleanExpected) === -1 && cleanExpected.indexOf(cleanAfter) === -1) {
					return { success: false, reason: `Text mismatch. Expected: "${props.newText.substring(0, 20)}...", Got: "${afterState.text.substring(0, 20)}..."` };
				}
			}
			// Only verify styling if the paragraph has text content
			if (afterState.text && afterState.text.trim() !== "") {
				if (props.fontName !== undefined && afterState.fontName !== props.fontName) {
					const cleanExpected = props.fontName.toLowerCase().replace(/['"\s]+/g, '');
					const cleanAfter = afterState.fontName.toLowerCase().replace(/['"\s]+/g, '');
					if (cleanAfter !== cleanExpected) {
						// Lenient fallback check: custom/niche fonts might not be installed/rendered locally by the editor engine.
						// If font name was set but defaulted to system Calibri/Times, and size or bold or underline did change successfully,
						// we treat it as successfully executed rather than looping retries endlessly.
						const sizeMatches = props.fontSize === undefined || afterState.fontSize === (props.fontSize / 2);
						const boldMatches = props.bold === undefined || afterState.bold === !!props.bold;
						const underlineMatches = props.underline === undefined || afterState.underline === !!props.underline;
						
						const sizeChanged = beforeState && beforeState.fontSize !== afterState.fontSize;
						const boldChanged = beforeState && beforeState.bold !== afterState.bold;
						const underlineChanged = beforeState && beforeState.underline !== afterState.underline;
						
						if ((props.fontSize && sizeMatches && sizeChanged) || 
							(props.bold !== undefined && boldMatches && boldChanged) || 
							(props.underline !== undefined && underlineMatches && underlineChanged)) {
							// Lenient bypass: other styles successfully applied to this element!
						} else {
							return { success: false, reason: `Font Family mismatch. Expected: "${props.fontName}", Got: "${afterState.fontName}"` };
						}
					}
				}
				if (props.fontSize !== undefined && afterState.fontSize !== (props.fontSize / 2)) {
					return { success: false, reason: `Font Size mismatch. Expected: ${props.fontSize / 2}pt, Got: ${afterState.fontSize}pt` };
				}
				if (props.bold !== undefined && afterState.bold !== !!props.bold) {
					return { success: false, reason: `Font Weight (Bold) mismatch. Expected: ${!!props.bold}, Got: ${afterState.bold}` };
				}
				if (props.underline !== undefined && afterState.underline !== !!props.underline) {
					return { success: false, reason: `Underline mismatch. Expected: ${!!props.underline}, Got: ${afterState.underline}` };
				}
			}
			return { success: true };
		}

		return { success: false, reason: "Unable to capture post-execution element state" };
	}

	// LAYER 2: Dynamic Intent-Routed Selection Serializer
	function serializeActiveContent(mode = "minimal") {
		return new Promise((resolve, reject) => {
			const failTimeout = setTimeout(() => {
				reject(new Error("Content scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 5000);

			window.Asc.scope.mode = mode;
			window.Asc.scope.prompt = promptInput ? promptInput.value.trim() : "";
			window.Asc.scope.selectionHtml = (window.Asc.plugin.info && window.Asc.plugin.info.selectionHtml) ? window.Asc.plugin.info.selectionHtml : "";

			window.Asc.plugin.callCommand(function() {
				var targetMode = Asc.scope.mode || "minimal";
				var prompt = Asc.scope.prompt || "";
				var selectionHtml = Asc.scope.selectionHtml || "";
				// Helper to extract styling from character run with full hierarchy inheritance
				function extractRunStyle(oRun, oElement) {
					var rFontName = "";
					var rFontSize = 0;
					var rBold = null;
					var rItalic = null;
					var rUnderline = null;
					var rStrikeout = null;
					var rColor = "";
					var rHighlight = null;
					var rShd = null;
					var rSmallCaps = null;
					var rCaps = null;
					var rSubscript = null;
					var rSuperscript = null;
					var rSpacing = 0;
					var rDoubleStrikeout = null;

					// 1. Direct from Run properties
					try {
						if (oRun.GetFontNames) {
							var names = oRun.GetFontNames();
							if (names && names.length > 0) rFontName = names[0] || "";
						}
					} catch(e) {}
					try { if (!rFontName && oRun.GetFontName) rFontName = oRun.GetFontName() || ""; } catch(e) {}
					try { if (oRun.GetFontSize) rFontSize = oRun.GetFontSize() || 0; } catch(e) {}
					try { if (oRun.GetBold) rBold = oRun.GetBold(); } catch(e) {}
					try { if (oRun.GetItalic) rItalic = oRun.GetItalic(); } catch(e) {}
					try { if (oRun.GetUnderline) rUnderline = !!oRun.GetUnderline(); } catch(e) {}
					try { if (oRun.GetStrikeout) rStrikeout = !!oRun.GetStrikeout(); } catch(e) {}
					try { if (oRun.GetSmallCaps) rSmallCaps = !!oRun.GetSmallCaps(); } catch(e) {}
					try { if (oRun.GetCaps) rCaps = !!oRun.GetCaps(); } catch(e) {}
					try { if (oRun.GetSubscript) rSubscript = !!oRun.GetSubscript(); } catch(e) {}
					try { if (oRun.GetSuperscript) rSuperscript = !!oRun.GetSuperscript(); } catch(e) {}
					try { if (oRun.GetSpacing) rSpacing = oRun.GetSpacing() || 0; } catch(e) {}
					try { if (oRun.GetDoubleStrikeout) rDoubleStrikeout = !!oRun.GetDoubleStrikeout(); } catch(e) {}
					try {
						if (oRun.GetColor) {
							var c = oRun.GetColor();
							if (c && c.GetHex) rColor = c.GetHex() || "";
						}
					} catch(e) {}

					// 2. From Text properties (TextPr)
					try {
						if (oRun.GetTextPr) {
							var tp = oRun.GetTextPr();
							if (tp) {
								if (!rFontName && tp.GetFontFamily) rFontName = tp.GetFontFamily() || "";
								if (!rFontSize && tp.GetFontSize) rFontSize = tp.GetFontSize() || 0;
								if (rBold === null && tp.GetBold) rBold = tp.GetBold();
								if (rItalic === null && tp.GetItalic) rItalic = tp.GetItalic();
								if (rUnderline === null && tp.GetUnderline) rUnderline = !!tp.GetUnderline();
								if (rStrikeout === null && tp.GetStrikeout) rStrikeout = !!tp.GetStrikeout();
								if (rSmallCaps === null && tp.GetSmallCaps) rSmallCaps = !!tp.GetSmallCaps();
								if (rCaps === null && tp.GetCaps) rCaps = !!tp.GetCaps();
								if (rSubscript === null && tp.GetSubscript) rSubscript = !!tp.GetSubscript();
								if (rSuperscript === null && tp.GetSuperscript) rSuperscript = !!tp.GetSuperscript();
								if (rSpacing === 0 && tp.GetSpacing) rSpacing = tp.GetSpacing() || 0;
								if (rDoubleStrikeout === null && tp.GetDoubleStrikeout) rDoubleStrikeout = !!tp.GetDoubleStrikeout();
								if (!rColor && tp.GetColor) {
									var c = tp.GetColor();
									if (c && c.GetHex) rColor = c.GetHex() || "";
								}
								if (tp.GetHighlight) {
									var hl = tp.GetHighlight();
									if (hl) {
										if (typeof hl === "string") rHighlight = hl;
										else if (hl.GetHex) rHighlight = hl.GetHex() || null;
									}
								}
								if (tp.GetShd) {
									var sd = tp.GetShd();
									if (sd) {
										if (typeof sd === "string") rShd = sd;
										else if (sd.GetHex) rShd = sd.GetHex() || null;
									}
								}
							}
						}
					} catch(e) {}

					// 3. Fallback to Paragraph Properties Style inheritance
					try {
						if (oElement && oElement.GetParaPr) {
							var pPr = oElement.GetParaPr();
							if (pPr && pPr.GetStyle) {
								var style = pPr.GetStyle();
								if (style && style.GetTextPr) {
									var stp = style.GetTextPr();
									if (stp) {
										if (!rFontName && stp.GetFontFamily) rFontName = stp.GetFontFamily() || "";
										if (!rFontSize && stp.GetFontSize) rFontSize = stp.GetFontSize() || 0;
										if (rBold === null && stp.GetBold) rBold = stp.GetBold();
										if (rItalic === null && stp.GetItalic) rItalic = stp.GetItalic();
										if (rUnderline === null && stp.GetUnderline) rUnderline = !!stp.GetUnderline();
										if (rStrikeout === null && stp.GetStrikeout) rStrikeout = !!stp.GetStrikeout();
										if (rSmallCaps === null && stp.GetSmallCaps) rSmallCaps = !!stp.GetSmallCaps();
										if (rCaps === null && stp.GetCaps) rCaps = !!stp.GetCaps();
										if (rSubscript === null && stp.GetSubscript) rSubscript = !!stp.GetSubscript();
										if (rSuperscript === null && stp.GetSuperscript) rSuperscript = !!stp.GetSuperscript();
										if (rSpacing === 0 && stp.GetSpacing) rSpacing = stp.GetSpacing() || 0;
										if (rDoubleStrikeout === null && stp.GetDoubleStrikeout) rDoubleStrikeout = !!stp.GetDoubleStrikeout();
										if (!rColor && stp.GetColor) {
											var c = stp.GetColor();
											if (c && c.GetHex) rColor = c.GetHex() || "";
										}
										if (!rHighlight && stp.GetHighlight) {
											var hl = stp.GetHighlight();
											if (hl) {
												if (typeof hl === "string") rHighlight = hl;
												else if (hl.GetHex) rHighlight = hl.GetHex() || null;
											}
										}
										if (!rShd && stp.GetShd) {
											var sd = stp.GetShd();
											if (sd) {
												if (typeof sd === "string") rShd = sd;
												else if (sd.GetHex) rShd = sd.GetHex() || null;
											}
										}
									}
								}
							}
						}
					} catch(e) {}

					// 4. Default fallbacks if still missing
					if (!rFontName) rFontName = "Calibri";
					if (!rFontSize) rFontSize = 22; // 11pt
					if (rBold === null) rBold = false;
					if (rItalic === null) rItalic = false;
					if (rUnderline === null) rUnderline = false;
					if (rStrikeout === null) rStrikeout = false;
					if (rSmallCaps === null) rSmallCaps = false;
					if (rCaps === null) rCaps = false;
					if (rSubscript === null) rSubscript = false;
					if (rSuperscript === null) rSuperscript = false;
					if (rDoubleStrikeout === null) rDoubleStrikeout = false;
					if (!rColor) rColor = "#000000";

					return {
						fontName: rFontName,
						fontSize: rFontSize / 2,
						bold: !!rBold,
						italic: !!rItalic,
						underline: !!rUnderline,
						strikeout: !!rStrikeout,
						smallCaps: !!rSmallCaps,
						caps: !!rCaps,
						subscript: !!rSubscript,
						superscript: !!rSuperscript,
						characterSpacing: rSpacing,
						doubleStrikeout: !!rDoubleStrikeout,
						color: rColor,
						highlight: rHighlight,
						shading: rShd
					};
				}

				// Helper to extract styling and layout from paragraph
				function extractParagraphStyle(selPara) {
					var oFontName = "Calibri";
					var oFontSize = 22;
					var oBold = false;
					var oItalic = false;
					var oUnderline = false;
					var oStrikeout = false;
					var oColor = "#000000";
					var oAlign = "left";
					var oSpaceBefore = 0;
					var oSpaceAfter = 0;
					var oLineSpacing = 1.0;
					var oLineSpacingRule = "auto";
					var oLineSpacingTwips = 0;
					var oShd = null;
					var listType = null;
					var oIndLeft = 0;
					var oIndRight = 0;
					var oIndFirstLine = 0;
					var oStyleName = null;

					// 1. Get properties from first run of paragraph
					try {
						var count = selPara.GetElementsCount();
						if (count > 0) {
							var firstRun = selPara.GetElement(0);
							if (firstRun && firstRun.GetClassType() === "run") {
								var runStyle = extractRunStyle(firstRun, selPara);
								oFontName = runStyle.fontName;
								oFontSize = runStyle.fontSize * 2;
								oBold = runStyle.bold;
								oItalic = runStyle.italic;
								oUnderline = runStyle.underline;
								oStrikeout = runStyle.strikeout;
								oColor = runStyle.color;
							}
						}
					} catch(e) {}

					// 2. Access ParaPr layout/spacing properties
					try {
						if (selPara.GetParaPr) {
							var pPr = selPara.GetParaPr();
							if (pPr) {
								if (pPr.GetJc) {
									var jc = pPr.GetJc();
									if (jc === "both" || jc === "justify") oAlign = "justify";
									else if (jc) oAlign = jc;
								}
								if (pPr.GetSpacingBefore) oSpaceBefore = pPr.GetSpacingBefore() || 0;
								if (pPr.GetSpacingAfter) oSpaceAfter = pPr.GetSpacingAfter() || 0;
								if (pPr.GetSpacingLineValue) oLineSpacingTwips = pPr.GetSpacingLineValue() || 0;
								if (pPr.GetSpacingLineRule) oLineSpacingRule = pPr.GetSpacingLineRule() || "auto";
								
								// Calculate line spacing multiplier
								if (oLineSpacingRule === "auto" && oLineSpacingTwips > 0) {
									oLineSpacing = Math.round((oLineSpacingTwips / 240) * 100) / 100;
								} else if (oLineSpacingTwips > 0) {
									oLineSpacing = Math.round((oLineSpacingTwips / 20) * 100) / 100; // in points
								}

								if (pPr.GetShd) {
									var sd = pPr.GetShd();
									if (sd) {
										if (typeof sd === "string") oShd = sd;
										else if (sd.GetHex) oShd = sd.GetHex() || null;
									}
								}
								
								if (pPr.GetIndLeft) oIndLeft = pPr.GetIndLeft() || 0;
								if (pPr.GetIndRight) oIndRight = pPr.GetIndRight() || 0;
								if (pPr.GetIndFirstLine) oIndFirstLine = pPr.GetIndFirstLine() || 0;
								
								if (pPr.GetStyle) {
									var style = pPr.GetStyle();
									if (style && style.GetName) oStyleName = style.GetName();
								}
							}
						}
					} catch(e) {}

					// 3. Detect Numbering/Bullet properties
					try {
						if (selPara.GetNumbering) {
							var num = selPara.GetNumbering();
							if (num) {
								listType = "numbered";
								if (num.GetNumFormat) {
									var fmt = num.GetNumFormat();
									if (fmt === "bullet") {
										listType = "bullet";
									}
								}
							}
						}
					} catch(e) {}

					return {
						fontName: oFontName,
						fontSize: oFontSize / 2,
						bold: oBold,
						italic: oItalic,
						underline: oUnderline,
						strikeout: oStrikeout,
						alignment: oAlign,
						color: oColor,
						spacingBefore: oSpaceBefore,
						spacingAfter: oSpaceAfter,
						lineSpacing: oLineSpacing,
						lineSpacingRule: oLineSpacingRule,
						lineSpacingTwips: oLineSpacingTwips,
						shading: oShd,
						listType: listType,
						indLeft: oIndLeft,
						indRight: oIndRight,
						indFirstLine: oIndFirstLine,
						styleName: oStyleName
					};
				}

				// Helper to omit default styles and duplicates (Delta compression)
				function compressParagraphStyle(style) {
					var compressed = {};
					var defaults = {
						fontName: "Calibri",
						fontSize: 11,
						bold: false,
						italic: false,
						underline: false,
						strikeout: false,
						alignment: "left",
						color: "#000000",
						spacingBefore: 0,
						spacingAfter: 0,
						lineSpacing: 1.0,
						lineSpacingRule: "auto",
						lineSpacingTwips: 0,
						shading: null,
						listType: null,
						indLeft: 0,
						indRight: 0,
						indFirstLine: 0,
						styleName: null
					};
					
					for (var key in style) {
						if (style.hasOwnProperty(key)) {
							var val = style[key];
							var def = defaults[key];
							if (val !== def) {
								if (def === null && !val) continue;
								compressed[key] = val;
							}
						}
					}
					return compressed;
				}

				// Helper to filter run styles that match the paragraph's resolved layout style
				function compressRunStyle(runStyle, paraStyle) {
					var compressed = {};
					if (runStyle.fontName !== paraStyle.fontName) compressed.fontName = runStyle.fontName;
					if (runStyle.fontSize !== paraStyle.fontSize) compressed.fontSize = runStyle.fontSize;
					if (runStyle.bold !== paraStyle.bold) compressed.bold = runStyle.bold;
					if (runStyle.italic !== paraStyle.italic) compressed.italic = runStyle.italic;
					if (runStyle.underline !== paraStyle.underline) compressed.underline = runStyle.underline;
					if (runStyle.strikeout !== paraStyle.strikeout) compressed.strikeout = runStyle.strikeout;
					if (runStyle.doubleStrikeout !== paraStyle.doubleStrikeout) compressed.doubleStrikeout = runStyle.doubleStrikeout;
					if (runStyle.smallCaps !== paraStyle.smallCaps) compressed.smallCaps = runStyle.smallCaps;
					if (runStyle.caps !== paraStyle.caps) compressed.caps = runStyle.caps;
					if (runStyle.subscript !== paraStyle.subscript) compressed.subscript = runStyle.subscript;
					if (runStyle.superscript !== paraStyle.superscript) compressed.superscript = runStyle.superscript;
					if (runStyle.characterSpacing !== paraStyle.characterSpacing && runStyle.characterSpacing !== 0) compressed.characterSpacing = runStyle.characterSpacing;
					if (runStyle.color !== paraStyle.color && runStyle.color !== "#000000") compressed.color = runStyle.color;
					if (runStyle.highlight && runStyle.highlight !== "none") compressed.highlight = runStyle.highlight;
					if (runStyle.shading) compressed.shading = runStyle.shading;

					for (var key in compressed) {
						if (compressed.hasOwnProperty(key)) {
							return compressed;
						}
					}
					return null;
				}

				// Define serializeRunsInside using rich style extraction & delta compression
				function serializeRunsInside(oElement, paraStyle) {
					var runsData = [];
					try {
						var count = oElement.GetElementsCount();
						for (var r = 0; r < count; r++) {
							var oRun = oElement.GetElement(r);
							if (oRun && oRun.GetClassType() === "run") {
								var rText = oRun.GetText() || "";
								if (rText === "") continue;
								
								var runStyle = extractRunStyle(oRun, oElement);
								var compressed = compressRunStyle(runStyle, paraStyle);
								
								var runObj = { text: rText };
								if (compressed) {
									runObj.style = compressed;
								}
								runsData.push(runObj);
							}
						}
					} catch(e) {}
					return runsData;
				}

				var oDocument = Api.GetDocument();
				var oRange = null;
				try {
					oRange = oDocument.GetRangeBySelect();
				} catch(e) {}
				
				// Determine if we have a valid selection containing actual text
				var isSelection = false;
				var selectedParagraphs = [];
				var selectedLines = [];
				
				// Force entire document mode if prompt indicates a document-wide intent
				var forceEntireDoc = /entire\s+doc|whole\s+doc|all\s+sections|entire\s+document|whole\s+document|format\s+everything|all\s+paragraphs|all\s+places|all\s+instances|everywhere|all\s+occurrences/i.test(prompt);
				var hasHighlight = false;
				if (selectionHtml) {
					hasHighlight = selectionHtml.trim().length > 0;
				} else {
					var rText = oRange ? (oRange.GetText() || "") : "";
					hasHighlight = rText.replace(/[\r\n\s\t]+/g, "").length > 0;
				}
				
				if (oRange && hasHighlight && !forceEntireDoc) {
					var rText = oRange.GetText() || "";
					var cleanText = rText.replace(/[\r\n\s\t]+/g, "");
					if (cleanText.length > 0) {
						isSelection = true;
						try {
							selectedParagraphs = oRange.GetAllParagraphs();
							selectedLines = rText.split(/\r\n|\r|\n/);
						} catch(e) {}
					}
				}
				
				var sections = [];
				var precedingContext = [];
				var succeedingContext = [];
				var documentHeadings = [];
				var pageSettings = null;
				var elementsCount = oDocument.GetElementsCount();
				
				var cursorIndex = -1;
				if (oRange) {
					try {
						var caretParagraphs = oRange.GetAllParagraphs();
						if (caretParagraphs && caretParagraphs.length > 0) {
							var caretPara = caretParagraphs[0];
							for (var j = 0; j < elementsCount; j++) {
								var docElem = oDocument.GetElement(j);
								if (docElem === caretPara) {
									cursorIndex = j;
									break;
								}
							}
						}
					} catch(e) {}
				}

				if (targetMode === "full" || targetMode === "medium") {
					// Compile global document outline map & section styles beforehand
					for (var h = 0; h < elementsCount; h++) {
						try {
							var oElem = oDocument.GetElement(h);
							if (oElem && oElem.GetClassType() === "paragraph") {
								var oText = oElem.GetText() || "";
								var paraStyle = extractParagraphStyle(oElem);
								var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
								var isHeading = false;
								
								if (paraStyle.styleName && paraStyle.styleName.toLowerCase().indexOf("heading") !== -1) {
									isHeading = true;
								} else if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
									isHeading = true;
								} else if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
									isHeading = true;
								} else if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
									isHeading = true;
								}
								
								if (isHeading) {
									documentHeadings.push({
										index: h,
										text: oText,
										styleName: paraStyle.styleName || ("Heading (Size " + paraStyle.fontSize + "pt)")
									});
								}
							}
						} catch(eOutline) {}
					}

					try {
						var firstSection = null;
						if (typeof oDocument.GetSections === "function") {
							var secs = oDocument.GetSections();
							if (secs && secs.length > 0) firstSection = secs[0];
						} else if (typeof oDocument.GetSection === "function") {
							firstSection = oDocument.GetSection(0);
						}
						if (firstSection) {
							pageSettings = {};
							try { if (firstSection.GetPageWidth) pageSettings.pageWidth = firstSection.GetPageWidth(); } catch(e) {}
							try { if (firstSection.GetPageHeight) pageSettings.pageHeight = firstSection.GetPageHeight(); } catch(e) {}
							try { if (firstSection.GetPageOrientation) pageSettings.pageOrientation = firstSection.GetPageOrientation(); } catch(e) {}
							try { if (firstSection.GetMarginLeft) pageSettings.marginLeft = firstSection.GetMarginLeft(); } catch(e) {}
							try { if (firstSection.GetMarginRight) pageSettings.marginRight = firstSection.GetMarginRight(); } catch(e) {}
							try { if (firstSection.GetMarginTop) pageSettings.marginTop = firstSection.GetMarginTop(); } catch(e) {}
							try { if (firstSection.GetMarginBottom) pageSettings.marginBottom = firstSection.GetMarginBottom(); } catch(e) {}
							try { if (typeof firstSection.GetColumnsCount === "function") pageSettings.columnsCount = firstSection.GetColumnsCount(); } catch(e) {}
						}
					} catch(ePage) {}
				}
				
				if (isSelection && selectedParagraphs.length > 0) {
					// --- SELECTION ONLY MODE (serialize only the highlighted range) ---
					var elements = [];
					var firstAbsIndex = -1;
					var lastAbsIndex = -1;
					
					// Pre-fetch all elements once to speed up lookup from O(N*M) to O(N)
					var allDocElements = [];
					for (var j = 0; j < elementsCount; j++) {
						allDocElements.push(oDocument.GetElement(j));
					}
					
					for (var i = 0; i < selectedParagraphs.length; i++) {
						var selPara = selectedParagraphs[i];
						if (!selPara) continue;
						
						// Find the absolute document element index
						var absoluteIndex = -1;
						for (var j = 0; j < allDocElements.length; j++) {
							var docElem = allDocElements[j];
							if (docElem && docElem.GetClassType() === "paragraph") {
								if (docElem === selPara) {
									absoluteIndex = j;
									break;
								}
							}
						}
						
						// Fallback check by text similarity if direct reference comparison fails
						if (absoluteIndex === -1) {
							var selText = selPara.GetText() || "";
							for (var j = 0; j < allDocElements.length; j++) {
								var docElem = allDocElements[j];
								if (docElem && docElem.GetClassType() === "paragraph" && docElem.GetText() === selText) {
									absoluteIndex = j;
									break;
								}
							}
						}
						
						if (absoluteIndex === -1) {
							absoluteIndex = i;
						}

						if (firstAbsIndex === -1) {
							firstAbsIndex = absoluteIndex;
						}
						lastAbsIndex = absoluteIndex;
						
						var fullParaText = selPara.GetText() || "";
						var selectedText = selectedLines[i] || "";
						var startIndex = fullParaText.indexOf(selectedText);
						if (startIndex === -1) startIndex = 0;
						
						// Get paragraph style details first for run style delta-compression
						var paraStyle = extractParagraphStyle(selPara);
						var cleanText = (selectedText || "").trim().replace(/[\r\n\t]+/g, '');
						var isHeading = false;
						
						if (paraStyle) {
							if (paraStyle.styleName && paraStyle.styleName.toLowerCase().indexOf("heading") !== -1) {
								isHeading = true;
							} else if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
								isHeading = true;
							} else if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
								isHeading = true;
							} else if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
								isHeading = true;
							}
						}
						var runsData = [];
						
						if (targetMode === "full") {
							var currentOffset = 0;
							try {
								var runCount = selPara.GetElementsCount();
								for (var r = 0; r < runCount; r++) {
									var oRun = selPara.GetElement(r);
									if (oRun && oRun.GetClassType() === "run") {
										var rText = oRun.GetText() || "";
										var runStart = currentOffset;
										var runEnd = currentOffset + rText.length;
										currentOffset = runEnd;
										
										var selStart = startIndex;
										var selEnd = startIndex + selectedText.length;
										
										// Compute intersection of the selection with the run
										var intersectStart = Math.max(runStart, selStart);
										var intersectEnd = Math.min(runEnd, selEnd);
										
										if (intersectStart < intersectEnd) {
											var slicedText = rText.substring(intersectStart - runStart, intersectEnd - runStart);
											if (slicedText.length > 0) {
												var runStyle = extractRunStyle(oRun, selPara);
												var compressed = compressRunStyle(runStyle, paraStyle);
												var runObj = { text: slicedText };
												if (compressed) {
													runObj.style = compressed;
												}
												runsData.push(runObj);
											}
										}
									}
								}
							} catch(errRuns) {}
							
							// If runs extraction intersects empty or misses, fall back to first run style or paragraph defaults
							if (runsData.length === 0 && selectedText.length > 0) {
								var compressed = compressRunStyle({
									fontName: paraStyle.fontName,
									fontSize: paraStyle.fontSize,
									bold: paraStyle.bold,
									italic: paraStyle.italic,
									underline: paraStyle.underline,
									strikeout: paraStyle.strikeout,
									doubleStrikeout: paraStyle.doubleStrikeout,
									smallCaps: paraStyle.smallCaps,
									caps: paraStyle.caps,
									subscript: paraStyle.subscript,
									superscript: paraStyle.superscript,
									characterSpacing: paraStyle.characterSpacing,
									color: paraStyle.color,
									highlight: null,
									shading: paraStyle.shading
								}, paraStyle);
								
								var runObj = { text: selectedText };
								if (compressed) {
									runObj.style = compressed;
								}
								runsData.push(runObj);
							}
						}
						
						var elementJSON = {
							type: isHeading ? "heading" : "paragraph",
							index: absoluteIndex,
							text: selectedText
						};
						
						if (targetMode !== "minimal" && paraStyle) {
							elementJSON.style = compressParagraphStyle(paraStyle);
						}
						
						if (targetMode === "full" && runsData.length > 0) {
							// Determine if the runs data contains no styling overrides (homogeneous paragraph check)
							var isHomogeneous = true;
							for (var k = 0; k < runsData.length; k++) {
								if (runsData[k].style) {
									isHomogeneous = false;
									break;
								}
							}
							if (!isHomogeneous) {
								elementJSON.runs = runsData;
							}
						}
						
						elements.push(elementJSON);
					}

					// Fetch Preceding and Succeeding Context paragraphs to make the Copilot fully aware of surroundings!
					if (targetMode === "full" && firstAbsIndex > 0) {
						var startPre = Math.max(0, firstAbsIndex - 4);
						for (var p = startPre; p < firstAbsIndex; p++) {
							try {
								var oElem = oDocument.GetElement(p);
								if (oElem && oElem.GetClassType() === "paragraph") {
									precedingContext.push({
										index: p,
										text: oElem.GetText() || "",
										style: compressParagraphStyle(extractParagraphStyle(oElem))
									});
								}
							} catch(ePre) {}
						}
					}
					
					if (targetMode === "full" && lastAbsIndex >= 0 && lastAbsIndex < elementsCount - 1) {
						var endSuf = Math.min(elementsCount, lastAbsIndex + 5);
						for (var p = lastAbsIndex + 1; p < endSuf; p++) {
							try {
								var oElem = oDocument.GetElement(p);
								if (oElem && oElem.GetClassType() === "paragraph") {
									succeedingContext.push({
										index: p,
										text: oElem.GetText() || "",
										style: compressParagraphStyle(extractParagraphStyle(oElem))
									});
								}
							} catch(eSuf) {}
						}
					}
					
					sections.push({
						title: "Active Selection Range",
						elements: elements
					});
					
				} else {
					// --- ENTIRE DOCUMENT MODE (Root Section fallback with Caret-Anchored sliding window) ---
					var currentSection = {
						title: "Root Section",
						elements: []
					};
					
					var indicesToSerialize = [];
					var maxWholeDocLimit = 45; // max elements to serialize in entire doc mode to prevent TPM limit errors
					
					if (elementsCount <= maxWholeDocLimit) {
						for (var i = 0; i < elementsCount; i++) {
							indicesToSerialize.push(i);
						}
					} else {
						var indexSet = {};
						
						// 1. First 15 paragraphs (Intro)
						var firstLimit = Math.min(15, elementsCount);
						for (var i = 0; i < firstLimit; i++) {
							indexSet[i] = true;
						}
						
						// 2. Last 15 paragraphs (Outro)
						var lastStart = Math.max(0, elementsCount - 15);
						for (var i = lastStart; i < elementsCount; i++) {
							indexSet[i] = true;
						}
						
						// 3. Cursor neighborhood: 15 paragraphs around cursor
						if (cursorIndex !== -1) {
							var cursorStart = Math.max(0, cursorIndex - 7);
							var cursorEnd = Math.min(elementsCount, cursorIndex + 8);
							for (var i = cursorStart; i < cursorEnd; i++) {
								indexSet[i] = true;
							}
						}
						
						for (var idx in indexSet) {
							indicesToSerialize.push(parseInt(idx, 10));
						}
						indicesToSerialize.sort(function(a, b) { return a - b; });
					}
					
					for (var sIdx = 0; sIdx < indicesToSerialize.length; sIdx++) {
						var i = indicesToSerialize[sIdx];
						try {
							var oElement = oDocument.GetElement(i);
							if (!oElement) continue;
							
							var type = oElement.GetClassType();
							
							if (type === "paragraph") {
								var oText = oElement.GetText() || "";
								var paraStyle = extractParagraphStyle(oElement);
								
								var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
								var isHeading = false;
								
								if (paraStyle) {
									if (paraStyle.styleName && paraStyle.styleName.toLowerCase().indexOf("heading") !== -1) {
										isHeading = true;
									} else if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
										isHeading = true;
									} else if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
										isHeading = true;
									} else if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
										isHeading = true;
									}
								}
								
								var runsData = [];
								if (targetMode === "full" && paraStyle) {
									runsData = serializeRunsInside(oElement, paraStyle);
								}
								
								var elementJSON = {
									type: isHeading ? "heading" : "paragraph",
									index: i,
									text: oText
								};
								
								if (targetMode !== "minimal" && paraStyle) {
									elementJSON.style = compressParagraphStyle(paraStyle);
								}
								
								if (targetMode === "full" && runsData.length > 0) {
									var isHomogeneous = true;
									for (var k = 0; k < runsData.length; k++) {
										if (runsData[k].style) {
											isHomogeneous = false;
											break;
										}
									}
									if (!isHomogeneous) {
										elementJSON.runs = runsData;
									}
								}
								
								if (isHeading) {
									if (currentSection.elements.length > 0) {
										sections.push(currentSection);
									}
									currentSection = {
										title: oText,
										elements: [elementJSON]
									};
								} else {
									currentSection.elements.push(elementJSON);
								}
								
							} else if (type === "table" && (targetMode === "full" || targetMode === "medium")) {
								var tableJSON = {
									type: "table",
									index: i,
									rows: []
								};
								
								try {
									var rowCount = oElement.GetRowsCount();
									tableJSON.rowsCount = rowCount;
									
									// Try to get table-level styles
									try {
										var style = oElement.GetStyle();
										if (style && typeof style.GetName === "function") {
											tableJSON.styleName = style.GetName();
										}
									} catch(eSt) {}
									try {
										if (typeof oElement.GetWidth === "function") {
											tableJSON.width = oElement.GetWidth();
										}
									} catch(eW) {}

									var rowLimit = Math.min(rowCount, 15);
									for (var r = 0; r < rowLimit; r++) {
										var oRow = oElement.GetRow(r);
										var cellsJSON = [];
										var rowJSON = {
											rowIndex: r,
											cells: cellsJSON
										};

										if (oRow) {
											// Row properties
											try {
												if (typeof oRow.GetHeight === "function") {
													rowJSON.height = oRow.GetHeight();
												}
												if (typeof oRow.GetCantSplit === "function") {
													rowJSON.cantSplit = oRow.GetCantSplit();
												}
												if (typeof oRow.GetHeader === "function") {
													rowJSON.isHeader = oRow.GetHeader();
												}
											} catch(eRowProp) {}

											var cellCount = oRow.GetCellsCount();
											if (r === 0) {
												tableJSON.colsCount = cellCount;
											}
											var cellLimit = Math.min(cellCount, 8);
											for (var c = 0; c < cellLimit; c++) {
												var oCell = oRow.GetCell(c);
												var cellText = "";
												var cellStyle = {};
												if (oCell) {
													var cellParagraphs = oCell.GetContent().GetAllParagraphs();
													var pTexts = [];
													for (var p = 0; p < Math.min(cellParagraphs.length, 5); p++) {
														pTexts.push(cellParagraphs[p].GetText() || "");
													}
													cellText = pTexts.join("\n");

													// Extract Cell Background Color
													try {
														if (typeof oCell.GetBackgroundColor === "function") {
															var bg = oCell.GetBackgroundColor();
															if (bg && typeof bg.GetHex === "function") {
																var bgHex = bg.GetHex();
																if (bgHex) cellStyle.shading = bgHex;
															}
														}
													} catch(eBg) {}
													
													// Extract Cell Width
													try {
														if (typeof oCell.GetWidth === "function") {
															cellStyle.width = oCell.GetWidth();
														}
													} catch(eCellW) {}

													// Extract Cell Vertical Alignment
													try {
														if (typeof oCell.GetVerticalAlign === "function") {
															cellStyle.verticalAlign = oCell.GetVerticalAlign();
														}
													} catch(eCellVA) {}
												}

												var cellJSON = {
													cellIndex: c,
													text: cellText
												};
												
												if (Object.keys(cellStyle).length > 0) {
													cellJSON.style = cellStyle;
												}
												cellsJSON.push(cellJSON);
											}
										}
										tableJSON.rows.push(rowJSON);
									}
								} catch(eTable) {}
								
								currentSection.elements.push(tableJSON);
							}
						} catch(pErr) {}
					}
					
					if (currentSection.elements.length > 0 || sections.length === 0) {
						sections.push(currentSection);
					}
				}
				
				return JSON.stringify({
					mode: isSelection ? "selection" : "document",
					targetMode: targetMode,
					metadata: {
						totalElements: elementsCount,
						selectedElementsCount: isSelection ? selectedParagraphs.length : elementsCount,
						selectionRange: isSelection ? { start: firstAbsIndex, end: lastAbsIndex } : null,
						pageSettings: pageSettings,
						cursorIndex: cursorIndex
					},
					documentHeadings: documentHeadings,
					surroundingContext: isSelection ? {
						preceding: precedingContext,
						succeeding: succeedingContext
					} : null,
					sectionsCount: sections.length,
					sections: sections
				});
			}, false, true, function(result) {
				clearTimeout(failTimeout);
				if (result) {
					resolve(result);
				} else {
					reject(new Error("Unable to read active document/selection contents."));
				}
			});
		});
	}

	function parseSerializedData(data) {
		if (typeof data === "object" && data !== null) {
			return data;
		}
		return JSON.parse(data);
	}

	// Unified LLM Requester supporting Groq API
	async function queryActiveLLM(messages, temperature = 0.1, isJsonMode = false) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

		try {
			const provider = localStorage.getItem('onescript_provider') || 'groq';
			let apiKey = localStorage.getItem('onescript_api_key') || localStorage.getItem('groq_copilot_key') || '';
			let model = localStorage.getItem('onescript_model') || localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
			let apiUrl = localStorage.getItem('onescript_api_url') || '';
			
			let fetchUrl = '';
			let headers = {
				'Content-Type': 'application/json'
			};
			
			if (provider === 'groq') {
				if (!apiKey) {
					throw new Error("Groq API Key is not configured. Add it in Settings.");
				}
				fetchUrl = 'https://api.groq.com/openai/v1/chat/completions';
				headers['Authorization'] = `Bearer ${apiKey}`;
			} else if (provider === 'ollama') {
				let url = apiUrl.trim() || 'http://localhost:11434';
				if (!url.endsWith('/chat/completions')) {
					if (url.endsWith('/')) url = url.substring(0, url.length - 1);
					if (!url.endsWith('/v1')) {
						url += '/v1';
					}
					url += '/chat/completions';
				}
				fetchUrl = url;
			} else if (provider === 'custom') {
				let url = apiUrl.trim() || 'http://localhost:8080/v1';
				if (!url.endsWith('/chat/completions')) {
					if (url.endsWith('/')) url = url.substring(0, url.length - 1);
					url += '/chat/completions';
				}
				fetchUrl = url;
				if (apiKey) {
					headers['Authorization'] = `Bearer ${apiKey}`;
				}
			}
			
			const requestBody = {
				model: model,
				messages: messages,
				temperature: temperature
			};
			
			if (isJsonMode) {
				requestBody.response_format = { type: 'json_object' };
			}
			
			const response = await fetch(fetchUrl, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);
			
			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				let errorMsg = `HTTP ${response.status}`;
				try {
					const errorData = JSON.parse(errorText);
					errorMsg = errorData.error?.message || errorMsg;
				} catch (parseErr) {
					if (errorText) errorMsg = `${errorMsg}: ${errorText.substring(0, 100)}`;
				}
				throw new Error(errorMsg);
			}
			
			const data = await response.json();
			return data.choices[0].message.content;
		} catch (err) {
			clearTimeout(timeoutId);
			if (err.name === 'AbortError') {
				throw new Error("API request timed out after 25 seconds. Please check your network connection or try again.");
			}
			throw err;
		}
	}

	// Query LLM with robust schema and selection context mapping
	async function queryLLM(docData, prompt, isSelection = false) {
		const systemMessage = `You are a professional document typesetter and layout agent. Your task is to analyze the provided JSON representation of a ${isSelection ? 'selected range of a document' : 'document'} and generate the requested style or content changes as a valid JSON object.
		
Each paragraph and table has a unique, absolute "index" identifying its location in the document.

CONTEXT-AWARE FEATURES & BOUNDARIES:
- The input JSON contains a "documentHeadings" outline array that identifies the headers of the document, their levels, and their target paragraph indices. Use this to maintain proper header structure and hierarchy!
- When you are editing a selected range, "surroundingContext" provides the preceding and succeeding paragraphs. Use this surrounding context to perform boundary-conscious, accurate, and styling-consistent text and layout updates that blend seamlessly into the document.
- The input metadata has "pageSettings" detailing the active margins and page orientation. Ensure your generated layout complies with these boundary limits!

You must output a JSON object containing a "changes" key which holds an array of edit commands. Each edit command must have the following structure:
{
  "changes": [
    {
      "action": "pasteHTML",
      "targetIndex": 0,
      "properties": {
        "html": "<h1>Rich Document Title</h1><p style='text-align:justify;'>Paragraph with <span style='color:#ff0000;font-weight:bold;'>red bold text</span> and <i>italic examples</i>...</p>"
      }
    }
  ]
}

Available actions:
- "pasteHTML": CRITICAL & HIGHLY PREFERRED action for generating new documents, writing essays, creating extensive articles, letters, reports, or executing large-scale structural text replacements. This passes a complete, richly-styled HTML string to the document editor, which ONLYOFFICE natively renders with perfect layout fidelity. The "properties" MUST contain an "html" key with the complete, beautifully typeset HTML.
  * targetIndex: The paragraph index where this content should be inserted/pasted (e.g. overwriting the active selection or replacing text).
  * properties: { "html": "<html string with h1, h2, p, ul, ol, li, and inline CSS style rules like text-align:justify; font-family:'Times New Roman'; font-size:12pt; color:#ff0000; text-decoration:underline; font-weight:bold; background-color:yellow;>" }
  * EXTENDED HTML TAGS & INLINE CSS PROPERTIES SUPPORTED:
    - <sup> (superscript), <sub> (subscript), <small> (small caps), <big> (caps with larger size), <del>/<s> (strikeout).
    - style="vertical-align: super | sub;" (superscript / subscript)
    - style="letter-spacing: 2pt;" (character spacing)
    - style="text-transform: uppercase | lowercase;" (caps / lowercase)
    - style="font-variant: small-caps;" (small caps)
    - style="text-decoration: underline | line-through | double-line-through;" (supports double strikeout)
    - style="margin-left: 20px; margin-right: 20px; text-indent: 10px;" (left, right, and first-line indentation)
- "modifyStyle": Set simple fonts, size, spacing, bold, alignment, color, or minor text updates on an existing paragraph index.
- "createParagraph": Create a new blank paragraph after the targetIndex.
- "deleteParagraph": Remove this paragraph from the document.
Formatting & units specifications for "modifyStyle":
- "fontName" (string, e.g. "Arial", "Georgia", "Inter", "Times New Roman", "Courier New")
- "fontSize" (number): Must be in standard points (e.g., 11 for 11pt, 12 for 12pt, 19 for 19pt).
- "bold" (boolean)
- "italic" (boolean)
- "underline" (boolean)
- "strikeout" (boolean)
- "doubleStrikeout" (boolean): Sets double-line strikeout formatting.
- "smallCaps" (boolean)
- "caps" (boolean)
- "subscript" (boolean)
- "superscript" (boolean)
- "characterSpacing" (integer): Spacing/letter-spacing in dxa units (20 dxa = 1pt).
- "color" (string hex code for text/font color, e.g. "#1d4ed8" or "#e11d48")
- "highlight" (string, text highlight/background color, e.g. "yellow", "red", "green", "blue", "cyan", "magenta", "none")
- "alignment" (string: "left", "right", "center", "justify")
- "spacingAfter" (integer, in dxa: 120 = 6pt, 240 = 12pt, 360 = 18pt)
- "spacingBefore" (integer, in dxa)
- "lineSpacing" (number): Spacing multiplier (e.g. 1.15, 1.5, 2.0).
- "indLeft" (integer): Left paragraph indentation in dxa (e.g. 240 = 12pt).
- "indRight" (integer): Right paragraph indentation in dxa.
- "indFirstLine" (integer): First line indentation in dxa. Use negative value for hanging indent.
- "shading" (string hex code): Paragraph background color shading (e.g., "#f3f4f6").
- "newText" (string, optional - only provide for minor text edits or simple updates)

INLINE GRANULAR FORMATTING IN "newText" (Only when using "modifyStyle"):
If using "modifyStyle" and the user's prompt requests specific formatting of certain words, phrases, headings, or elements inside that paragraph, you can use standard inline HTML tags inside "newText".
However, remember that "pasteHTML" is the absolute standard and is 100% preferred over "modifyStyle" for all long-form content generation and writing tasks!

${isSelection ? 'IMPORTANT: You are targeting the ACTIVE SELECTION range. Apply modifications only targeting elements present inside the active selection.' : 'If the user wants a global change (e.g. "change the entire font color to yellow"), you MUST generate "modifyStyle" commands for EVERY single paragraph index in the document.'}
Respond ONLY with a valid JSON object. Do not include markdown code block formatting (like \`\`\`json).`;

		const userMessage = `Current Document Structure:
${JSON.stringify(docData, null, 2)}

User Request:
"${prompt}"`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: userMessage }
		];

		return await queryActiveLLM(messages, 0.1, true);
	}

	// Parse JSON array of changes
	function parseAIResponse(responseStr) {
		try {
			let cleanStr = responseStr.trim();
			if (cleanStr.startsWith('```')) {
				cleanStr = cleanStr.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
			}
			
			const parsed = JSON.parse(cleanStr);
			
			if (Array.isArray(parsed)) {
				return parsed;
			} else if (parsed.plans && Array.isArray(parsed.plans)) {
				return parsed.plans;
			} else if (parsed.plan && Array.isArray(parsed.plan)) {
				return parsed.plan;
			} else if (parsed.actions && Array.isArray(parsed.actions)) {
				return parsed.actions;
			} else if (parsed.changes && Array.isArray(parsed.changes)) {
				return parsed.changes;
			} else if (parsed.commands && Array.isArray(parsed.commands)) {
				return parsed.commands;
			} else if (typeof parsed === 'object' && parsed !== null) {
				// If it is a single plan object rather than an array of plans
				if (parsed.action && parsed.properties) {
					return [parsed];
				}
				// If it's a wrapper object with plans nested under a single object
				for (const key in parsed) {
					if (Array.isArray(parsed[key])) {
						return parsed[key];
					}
				}
				return [parsed];
			}
			
			return [];
		} catch (e) {
			throw new Error("Could not parse a valid JSON action script from the AI's response.");
		}
	}



	// Sequential, Gated, Self-Healing executor engine utilizing Verification and Retry layers
	function executeSequentialEdits(changes, aiMessageBody) {
		// Normalize standard points to half-points for OnlyOffice API compatibility once
		if (changes && Array.isArray(changes)) {
			changes.forEach(change => {
				if (change && change.properties && change.properties.fontSize !== undefined) {
					change.properties.fontSize = Number(change.properties.fontSize) * 2;
				}
			});
		}

		let i = 0;
		let modifications = []; // Track modifications history for position-dependent index shift
		let retryCount = 0;
		const maxRetries = 3;
		
		async function applyNext() {
			try {
				if (i >= changes.length) {
					log('All autonomous AI edits applied live, verified, and completed!', 'success');
					setStepperStep(3, "done", `Applied ${changes.length} edits successfully`);
					proposedChanges = null;
					executeBtn.disabled = false;
					isEditingAutonomously = false;
					lastInternalQueryTime = Date.now();
				appliedChangesCount = changes.length;
				undoAiBtn.style.display = 'inline-flex';

				// Show summary review panel with Keep/Undo buttons immediately inside the chat history
				renderChatPreview(aiMessageBody, changes, true);

				// Update execution telemetry
				lastExecutionDebugData.status = "Success (All action steps executed and verified successfully!)";
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				
				// Perform single clean refresh of structure view once editor modifications finish
				setTimeout(() => {
					refreshDocStructureView();
				}, 200);
				return;
			}

			const change = changes[i];
			const actionName = change.action || 'rewrite';
			const targetIndex = change.targetIndex;
			
			// Dynamically calculate shift based on previous modifications that occurred before the target index
			let shift = 0;
			for (const mod of modifications) {
				if (targetIndex > mod.targetIndex) {
					shift += mod.delta;
				}
			}
			const actualTargetIndex = targetIndex + shift;

			log(`Applying action [${actionName.toUpperCase()}] to element #${targetIndex + 1} (actual index #${actualTargetIndex + 1}). Attempt ${retryCount + 1}/${maxRetries}...`, 'info');

			setStepperStep(3, "running", `Applying ${actionName} on element #${targetIndex + 1} (${i + 1}/${changes.length})`);

			// Capture element state before applying change
			const beforeState = await captureElementState(actualTargetIndex);

			// Append to telemetry stateBefore (only on first attempt)
			if (retryCount === 0) {
				lastExecutionDebugData.stateBefore.push({
					stepIndex: i,
					action: actionName,
					targetIndex: targetIndex,
					actualIndex: actualTargetIndex,
					state: beforeState
				});
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
			}

			// Wrapper to run the edit inside ONLYOFFICE Sandbox
			function runEditCommand() {
				return new Promise((resolve) => {
					window.Asc.scope.change = change;
					window.Asc.scope.actualTargetIndex = actualTargetIndex;
					window.Asc.scope.helperCode = parseAndApplyTextWithTags.toString();

					if (actionName === 'delete_paragraph' || actionName === 'deleteParagraph') {
						window.Asc.plugin.callCommand(function() {
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							try { oDocument.RemoveElement(actualTargetIndex); } catch(e) {}
							var countAfter = oDocument.GetElementsCount();
							return { countBefore: countBefore, countAfter: countAfter };
						}, false, true, function(res) {
							var delta = res ? (res.countAfter - res.countBefore) : -1;
							resolve({ delta: delta });
						});
					} else if (actionName === 'create_paragraph' || actionName === 'createParagraph') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							var parseAndApplyTextWithTags = function(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
								try { oPar.RemoveAllElements(); } catch(e) {}
								
								function applyFormatToRun(oRun, formatState) {
									if (!oRun) return;
									
									// 1. Direct ApiRun styling properties
									try {
										if (formatState.fontName) {
											if (typeof oRun.SetFontName === "function") oRun.SetFontName(formatState.fontName);
										}
										if (formatState.fontSize) {
											if (typeof oRun.SetFontSize === "function") oRun.SetFontSize(formatState.fontSize);
										}
										if (typeof oRun.SetBold === "function") oRun.SetBold(!!formatState.bold);
										if (typeof oRun.SetItalic === "function") oRun.SetItalic(!!formatState.italic);
										if (typeof oRun.SetUnderline === "function") oRun.SetUnderline(!!formatState.underline);
										if (typeof oRun.SetStrikeout === "function") oRun.SetStrikeout(!!formatState.strikeout);
										if (typeof oRun.SetDoubleStrikeout === "function") oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout);
										if (typeof oRun.SetSmallCaps === "function") oRun.SetSmallCaps(!!formatState.smallCaps);
										if (typeof oRun.SetCaps === "function") oRun.SetCaps(!!formatState.caps);
										if (typeof oRun.SetSubscript === "function") oRun.SetSubscript(!!formatState.subscript);
										if (typeof oRun.SetSuperscript === "function") oRun.SetSuperscript(!!formatState.superscript);
										if (formatState.characterSpacing && typeof oRun.SetSpacing === "function") oRun.SetSpacing(formatState.characterSpacing);
										
										if (formatState.highlight) {
											var hl = formatState.highlight.toLowerCase().trim();
											var mappedHl = "none";
											if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
											else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
											else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
											else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
											else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
											else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
											else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
											else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") mappedHl = "lightGray";
											else mappedHl = hl;
											if (typeof oRun.SetHighlight === "function") oRun.SetHighlight(mappedHl);
										}
										
										if (formatState.color) {
											var hex = String(formatState.color).replace('#', '').trim();
											if (/^[0-9a-fA-F]{6}$/.test(hex)) {
												var red = parseInt(hex.substring(0, 2), 16);
												var green = parseInt(hex.substring(2, 4), 16);
												var blue = parseInt(hex.substring(4, 6), 16);
												if (typeof oRun.SetColor === "function") {
													try { oRun.SetColor(red, green, blue); } catch(eC1) {}
													try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eC2) {}
												}
											} else {
												var namedColors = {
													"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
													"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
													"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
												};
												if (namedColors[hex.toLowerCase()]) {
													var rgb = namedColors[hex.toLowerCase()];
													if (typeof oRun.SetColor === "function") {
														try { oRun.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC3) {}
														try { oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC4) {}
													}
												}
											}
										}
									} catch(eRunDirect) {}

									// 2. Fallback to ApiRange transient/selection properties
									var oRunRange = oRun;
									try {
										var r = oRun.GetRange();
										if (r) oRunRange = r;
									} catch(e) {}
									
									if (formatState.fontName) {
										try { if (oRunRange.SetFontFamily) oRunRange.SetFontFamily(formatState.fontName); } catch(e) {}
										try { if (oRunRange.SetFontName) oRunRange.SetFontName(formatState.fontName); } catch(e) {}
									}
									if (formatState.fontSize) {
										try { if (oRunRange.SetFontSize) oRunRange.SetFontSize(formatState.fontSize); } catch(e) {}
									}
									try { if (oRunRange.SetBold) oRunRange.SetBold(!!formatState.bold); } catch(e) {}
									try { if (oRunRange.SetItalic) oRunRange.SetItalic(!!formatState.italic); } catch(e) {}
									try { if (oRunRange.SetUnderline) oRunRange.SetUnderline(!!formatState.underline); } catch(e) {}
									try { if (oRunRange.SetStrikeout) oRunRange.SetStrikeout(!!formatState.strikeout); } catch(e) {}
									try { if (oRunRange.SetDoubleStrikeout) oRunRange.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
									try { if (oRunRange.SetSmallCaps) oRunRange.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
									try { if (oRunRange.SetCaps) oRunRange.SetCaps(!!formatState.caps); } catch(e) {}
									try { if (oRunRange.SetSubscript) oRunRange.SetSubscript(!!formatState.subscript); } catch(e) {}
									try { if (oRunRange.SetSuperscript) oRunRange.SetSuperscript(!!formatState.superscript); } catch(e) {}
									try { if (formatState.characterSpacing && oRunRange.SetSpacing) oRunRange.SetSpacing(formatState.characterSpacing); } catch(e) {}
									
									if (formatState.highlight) {
										try {
											var hl = formatState.highlight.toLowerCase().trim();
											var mappedHl = "none";
											if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
											else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
											else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
											else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
											else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
											else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
											else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
											else if (hl.indexOf("gray") !== -1 || hl === "#grey" || hl === "#808080") mappedHl = "lightGray";
											else mappedHl = hl;
											
											try { if (oRunRange.SetHighlight) oRunRange.SetHighlight(mappedHl); } catch(e) {}
											
											if (typeof oRunRange.GetTextPr === "function" && typeof oRunRange.SetTextPr === "function") {
												try {
													var tp = oRunRange.GetTextPr();
													if (tp && tp.SetHighlight) {
														tp.SetHighlight(mappedHl);
														oRunRange.SetTextPr(tp);
													}
												} catch(eTp) {}
											}
										} catch(eHighlight) {}
									}
									
									if (formatState.color) {
										try {
											var hex = String(formatState.color).replace('#', '').trim();
											if (/^[0-9a-fA-F]{6}$/.test(hex)) {
												var red = parseInt(hex.substring(0, 2), 16);
												var green = parseInt(hex.substring(2, 4), 16);
												var blue = parseInt(hex.substring(4, 6), 16);
												try { oRunRange.SetColor(red, green, blue); } catch(eColor) {}
												try {
													var colorObj = Api.CreateColorFromRGB(red, green, blue);
													oRunRange.SetColor(colorObj);
												} catch(eColorRGB) {}
											} else {
												var namedColors = {
													"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
													"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
													"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
												};
												if (namedColors[hex.toLowerCase()]) {
													var rgb = namedColors[hex.toLowerCase()];
													try { oRunRange.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC) {}
													try { oRunRange.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC) {}
												}
											}
										} catch(eColorOuter) {}
									}
								}

								if (htmlStr) {
									htmlStr = htmlStr
										.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
										.replace(/__(.*?)__/g, '<b>$1</b>')
										.replace(/\*(.*?)\*/g, '<i>$1</i>')
										.replace(/_(.*?)_/g, '<i>$1</i>');
								}
								var regex = /(<[^>]+>)/g;
								var parts = String(htmlStr || "").split(regex);
								var formatState = {
									fontName: pProps.fontName || defFont || "Calibri",
									fontSize: pProps.fontSize || defSize || 22,
									bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
									italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
									underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
									strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
									doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
									smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
									caps: pProps.caps !== undefined ? pProps.caps : false,
									subscript: pProps.subscript !== undefined ? pProps.subscript : false,
									superscript: pProps.superscript !== undefined ? pProps.superscript : false,
									characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
									color: pProps.color || defColorHex || "#000000",
									highlight: pProps.highlight || defHighlight || "none"
								};

								if (!htmlStr) {
									var oRun = null;
									try { oRun = oPar.AddText(""); } catch(eText) {}
									if (oRun) {
										applyFormatToRun(oRun, formatState);
									}
									return;
								}

								var stateStack = [JSON.parse(JSON.stringify(formatState))];
								for (var idx = 0; idx < parts.length; idx++) {
									var part = parts[idx];
									if (!part) continue;
									if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
										var tagLower = part.toLowerCase();
										if (tagLower.indexOf("</") === 0) {
											if (stateStack.length > 1) {
												stateStack.pop();
												formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
											}
										} else {
											var newState = JSON.parse(JSON.stringify(formatState));
											if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
												newState.bold = true;
											} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
												newState.italic = true;
											} else if (tagLower.indexOf("<u") === 0) {
												newState.underline = true;
											} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || /^<s[> \/]/i.test(tagLower)) {
												newState.strikeout = true;
											} else if (tagLower.indexOf("<sub>") === 0) {
												newState.subscript = true;
												newState.superscript = false;
											} else if (tagLower.indexOf("<sup>") === 0) {
												newState.superscript = true;
												newState.subscript = false;
											} else if (tagLower.indexOf("<small>") === 0) {
												newState.smallCaps = true;
											} else if (tagLower.indexOf("<big>") === 0) {
												newState.caps = true;
												newState.fontSize = Math.round(newState.fontSize * 1.2);
											} else if (tagLower.indexOf("<font") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												if (match && match[1]) newState.color = match[1];
												var matchFace = part.match(/face=["']([^"']+)["']/i);
												if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
												var matchSize = part.match(/size=["']([^"']+)["']/i);
												if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
											} else if (tagLower.indexOf("<mark") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (match && match[1]) {
													newState.highlight = match[1];
												} else if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													var foundBg = false;
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'background-color' || propName === 'background' || propName === 'color') {
																newState.highlight = propVal;
																foundBg = true;
															}
														}
													}
													if (!foundBg) newState.highlight = "yellow";
												} else {
													newState.highlight = "yellow";
												}
											} else if (tagLower.indexOf("<span") === 0) {
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'font-weight') {
																if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
																else if (propVal === 'normal' || propVal === '400') newState.bold = false;
															} else if (propName === 'font-style') {
																if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
																else if (propVal === 'normal') newState.italic = false;
															} else if (propName === 'text-decoration') {
																if (propVal.indexOf('underline') !== -1) newState.underline = true;
																if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
																if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
															} else if (propName === 'color') {
																newState.color = propVal;
															} else if (propName === 'background-color' || propName === 'background') {
																newState.highlight = propVal;
															} else if (propName === 'font-family') {
																newState.fontName = propVal.replace(/['"]/g, '').trim();
															} else if (propName === 'font-size') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.fontSize = Math.round(numVal * 2);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.fontSize = Math.round(numVal * 1.5);
																}
															} else if (propName === 'letter-spacing') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 20);
								} else if (propVal.indexOf('px') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 15);
																} else {
																	newState.characterSpacing = Math.round(numVal);
																}
															} else if (propName === 'text-transform') {
																if (propVal === 'uppercase') newState.caps = true;
																else if (propVal === 'lowercase') newState.caps = false;
															} else if (propName === 'font-variant') {
																if (propVal === 'small-caps') newState.smallCaps = true;
															} else if (propName === 'vertical-align') {
																if (propVal === 'super') {
																	newState.superscript = true;
																	newState.subscript = false;
																} else if (propVal === 'sub') {
																	newState.subscript = true;
																	newState.superscript = false;
																}
															}
														}
													}
												}
											}
											stateStack.push(newState);
											formatState = newState;
										}
									} else {
										var decText = part
											.replace(/&quot;/g, '"')
											.replace(/&lt;/g, '<')
											.replace(/&gt;/g, '>')
											.replace(/&amp;/g, '&')
											.replace(/&#39;/g, "'")
											.replace(/&apos;/g, "'");
										var oRun = null;
										try { oRun = oPar.AddText(decText); } catch(eText) {}
										if (oRun) {
											applyFormatToRun(oRun, formatState);
										}
									}
								}
							};
							
							// Clamp index to prevent out-of-bounds AddElement errors when appending
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							var origFont = "Calibri";
							var origSize = 22;
							var origBold = false;
							var origItalic = false;
							var origUnderline = false;
							var origStrikeout = false;
							var origColorHex = "#000000";
							var origHighlight = "none";
							
							var origAlign = "left";
							var origSpaceBefore = 0;
							var origSpaceAfter = 0;
							var origLineSpacing = 1.15;
							var origIndLeft = 0;
							var origIndRight = 0;
							var origIndFirstLine = 0;
							var origShading = null;
							
							var oRefParagraph = oDocument.GetElement(actualTargetIndex);
							if (oRefParagraph) {
								try {
									var runCount = oRefParagraph.GetElementsCount();
									if (runCount > 0) {
										var firstRun = oRefParagraph.GetElement(0);
										if (firstRun) {
											var textPr = null;
											try { if (typeof firstRun.GetTextPr === "function") textPr = firstRun.GetTextPr(); } catch(e) {}
											if (textPr) {
												try { 
													if (typeof textPr.GetFontFamily === "function") {
														origFont = textPr.GetFontFamily() || origFont;
													} else if (typeof textPr.GetFontName === "function") {
														origFont = textPr.GetFontName() || origFont;
													}
												} catch(e) {}
												try { if (typeof textPr.GetFontSize === "function") origSize = textPr.GetFontSize() || origSize; } catch(e) {}
												try { if (typeof textPr.GetBold === "function") origBold = textPr.GetBold() || origBold; } catch(e) {}
												try { if (typeof textPr.GetItalic === "function") origItalic = textPr.GetItalic() || origItalic; } catch(e) {}
												try { if (typeof textPr.GetUnderline === "function") origUnderline = !!textPr.GetUnderline(); } catch(e) {}
												try { if (typeof textPr.GetStrikeout === "function") origStrikeout = !!textPr.GetStrikeout(); } catch(e) {}
												try {
													if (typeof textPr.GetColor === "function") {
														var c = textPr.GetColor();
														if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
													}
												} catch(e) {}
												try {
													if (typeof textPr.GetHighlight === "function") {
														var hl = textPr.GetHighlight();
														if (hl) {
															if (typeof hl === "string") origHighlight = hl;
															else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
														}
													}
												} catch(e) {}
											}
										}
									}
									
									if ((origFont === "Calibri" || !origFont) && typeof oRefParagraph.GetTextPr === "function") {
										var pTp = oRefParagraph.GetTextPr();
										if (pTp) {
											try {
												if (typeof pTp.GetFontFamily === "function") {
													origFont = pTp.GetFontFamily() || origFont;
												} else if (typeof pTp.GetFontName === "function") {
													origFont = pTp.GetFontName() || origFont;
												}
											} catch(e) {}
											try { if (typeof pTp.GetFontSize === "function") origSize = pTp.GetFontSize() || origSize; } catch(e) {}
											try { if (typeof pTp.GetBold === "function") origBold = pTp.GetBold() || origBold; } catch(e) {}
											try { if (typeof pTp.GetItalic === "function") origItalic = pTp.GetItalic() || origItalic; } catch(e) {}
											try { if (typeof pTp.GetUnderline === "function") origUnderline = !!pTp.GetUnderline(); } catch(e) {}
											try { if (typeof pTp.GetStrikeout === "function") origStrikeout = !!pTp.GetStrikeout(); } catch(e) {}
											try {
												if (typeof pTp.GetColor === "function") {
													var c = pTp.GetColor();
													if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
												}
											} catch(e) {}
											try {
												if (typeof pTp.GetHighlight === "function") {
													var hl = pTp.GetHighlight();
													if (hl) {
														if (typeof hl === "string") origHighlight = hl;
														else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
													}
												}
											} catch(e) {}
										}
									}
									
									if (oRefParagraph.GetParaPr) {
										var pPr = oRefParagraph.GetParaPr();
										if (pPr) {
											if (pPr.GetJc) {
												var jc = pPr.GetJc();
												if (jc === "both" || jc === "justify") origAlign = "justify";
												else if (jc) origAlign = jc;
											}
											if (pPr.GetSpacingBefore) origSpaceBefore = pPr.GetSpacingBefore() || 0;
											if (pPr.GetSpacingAfter) origSpaceAfter = pPr.GetSpacingAfter() || 0;
											if (pPr.GetSpacingLineValue) {
												var lineVal = pPr.GetSpacingLineValue();
												if (lineVal) {
													var rule = pPr.GetSpacingLineRule ? pPr.GetSpacingLineRule() : "auto";
													if (rule === "auto") origLineSpacing = lineVal / 240;
													else origLineSpacing = lineVal / 20;
												}
											}
											if (pPr.GetIndLeft) origIndLeft = pPr.GetIndLeft() || 0;
											if (pPr.GetIndRight) origIndRight = pPr.GetIndRight() || 0;
											if (pPr.GetIndFirstLine) origIndFirstLine = pPr.GetIndFirstLine() || 0;
											if (pPr.GetShd) {
												var sd = pPr.GetShd();
												if (sd) {
													if (typeof sd === "string") origShading = sd;
													else if (sd.GetHex) origShading = sd.GetHex() || null;
												}
											}
										}
									}
								} catch(e) {}
							}
							
							var oNewParagraph = Api.CreateParagraph();
							var oProps = change.properties || {};
							try {
								oDocument.AddElement(actualTargetIndex + 1, oNewParagraph);
								
								var oParaPr = oNewParagraph.GetParaPr();
								if (oParaPr) {
									var targetAlign = oProps.alignment !== undefined ? oProps.alignment : origAlign;
									if (targetAlign === "justify") oParaPr.SetJc("both");
									else if (targetAlign) oParaPr.SetJc(targetAlign);

									var targetSpaceBefore = oProps.spacingBefore !== undefined ? Number(oProps.spacingBefore) : origSpaceBefore;
									if (targetSpaceBefore !== null && targetSpaceBefore !== undefined) oParaPr.SetSpacingBefore(targetSpaceBefore);

									var targetSpaceAfter = oProps.spacingAfter !== undefined ? Number(oProps.spacingAfter) : origSpaceAfter;
									if (targetSpaceAfter !== null && targetSpaceAfter !== undefined) oParaPr.SetSpacingAfter(targetSpaceAfter);

									var targetLineSpacing = oProps.lineSpacing !== undefined ? Number(oProps.lineSpacing) : origLineSpacing;
									if (targetLineSpacing !== null && targetLineSpacing !== undefined) {
										oParaPr.SetSpacingLine(Math.round(targetLineSpacing * 240), "auto");
									}

									var targetIndLeft = oProps.indLeft !== undefined ? Number(oProps.indLeft) : origIndLeft;
									if (targetIndLeft !== null && targetIndLeft !== undefined) oParaPr.SetIndLeft(targetIndLeft);

									var targetIndRight = oProps.indRight !== undefined ? Number(oProps.indRight) : origIndRight;
									if (targetIndRight !== null && targetIndRight !== undefined) oParaPr.SetIndRight(targetIndRight);

									var targetIndFirstLine = oProps.indFirstLine !== undefined ? Number(oProps.indFirstLine) : origIndFirstLine;
									if (targetIndFirstLine !== null && targetIndFirstLine !== undefined) oParaPr.SetIndFirstLine(targetIndFirstLine);

									var targetShd = oProps.shading !== undefined ? oProps.shading : origShading;
									if (targetShd) {
										var hex = String(targetShd).replace('#', '').trim();
										if (/^[0-9a-fA-F]{6}$/.test(hex)) {
											try { oParaPr.SetShd("clear", Api.CreateColorFromRGB(parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16))); } catch(e) {}
										}
									}
								}
								
								if (oProps.newText) {
									parseAndApplyTextWithTags(oNewParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, origHighlight, oProps);
								}
								
								// Apply list numbering directly if specified in properties
								if (oProps.listType) {
									var listType = oProps.listType === "bullet" ? "bulleted" : "numbered";
									var oNumbering = oDocument.CreateNumbering(listType);
									if (oNumbering) {
										var level = oProps.level !== undefined ? Number(oProps.level) : 0;
										var oLevel = oNumbering.GetLevel(level);
										if (oLevel) {
											var style = oProps.style || (oProps.listType === "bullet" ? "bullet" : "decimal");
											var formatString = oProps.formatString || (oProps.listType === "bullet" ? "•" : "%1.");
											oLevel.SetCustomType(style, formatString, "left");
											oNewParagraph.SetNumbering(oLevel);
										}
									}
								}
							} catch(e) {}
							
							var countAfter = oDocument.GetElementsCount();
							return { countBefore: countBefore, countAfter: countAfter };
						}, false, true, function(res) {
							var delta = res ? (res.countAfter - res.countBefore) : 1;
							resolve({ delta: delta });
						});
					} else if (actionName === 'paste_html' || actionName === 'pasteHTML') {
						window.Asc.plugin.callCommand(function() {
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							if (oParagraph) {
								oParagraph.Select();
							}
							return countBefore;
						}, false, true, function(countBefore) {
							window.Asc.plugin.executeMethod("PasteHtml", [change.properties.html || ''], function() {
								window.Asc.plugin.callCommand(function() {
									return Api.GetDocument().GetElementsCount();
								}, false, true, function(countAfter) {
									var delta = (countAfter !== undefined && countBefore !== undefined) ? (countAfter - countBefore) : 0;
									resolve({ delta: delta });
								});
							});
						});
					} else if (actionName === 'make_list' || actionName === 'makeList') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oProps = change.properties || {};
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							if (oParagraph && oParagraph.GetClassType() === "paragraph") {
								var listType = oProps.listType === "bullet" ? "bulleted" : "numbered";
								var oNumbering = oDocument.CreateNumbering(listType);
								if (oNumbering) {
									var level = oProps.level !== undefined ? Number(oProps.level) : 0;
									var oLevel = oNumbering.GetLevel(level);
									if (oLevel) {
										var style = oProps.style || (oProps.listType === "bullet" ? "bullet" : "decimal");
										var formatString = oProps.formatString || (oProps.listType === "bullet" ? "•" : "%1.");
										oLevel.SetCustomType(style, formatString, "left");
										oParagraph.SetNumbering(oLevel);
									}
								}
							}
							return true;
						}, false, true, function() {
							resolve({ delta: 0 });
						});
					} else if (actionName === 'table_action' || actionName === 'tableAction') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oProps = change.properties || {};
							var subAction = change.subAction || oProps.subAction;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							// Clamp index to prevent out-of-bounds AddElement errors when appending
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							if (subAction === 'create') {
								var rows = Number(oProps.rows || 2);
								var cols = Number(oProps.cols || 2);
								var oTable = Api.CreateTable(cols, rows);
								if (oTable) {
									// Populate cellData if provided
									if (oProps.cellData && Array.isArray(oProps.cellData)) {
										for (var r = 0; r < Math.min(rows, oProps.cellData.length); r++) {
											var rowData = oProps.cellData[r];
											if (rowData && Array.isArray(rowData)) {
												for (var c = 0; c < Math.min(cols, rowData.length); c++) {
													var textVal = String(rowData[c] || "");
													var cell = oTable.GetCell(r, c);
													if (cell) {
														var cellContent = cell.GetContent();
														var cellParagraphs = cellContent.GetAllParagraphs();
														if (cellParagraphs && cellParagraphs.length > 0) {
															cellParagraphs[0].RemoveAllElements();
															cellParagraphs[0].AddText(textVal);
														} else {
															var oPara = Api.CreateParagraph();
															oPara.AddText(textVal);
															cellContent.AddElement(0, oPara);
														}
													}
												}
											}
										}
									}
									oDocument.AddElement(actualTargetIndex + 1, oTable);
									return { delta: 1 };
								}
								return { delta: 0 };
							}
							
							var oTable = oDocument.GetElement(actualTargetIndex);
							if (oTable && oTable.GetClassType() === "table") {
								if (subAction === 'add_row' || subAction === 'addRow') {
									var rowIndex = oProps.rowIndex !== undefined ? Number(oProps.rowIndex) : oTable.GetRowsCount() - 1;
									var before = !!oProps.before;
									var refRow = oTable.GetRow(rowIndex);
									if (refRow) {
										var refCell = refRow.GetCell(0);
										if (refCell) oTable.AddRow(refCell, before);
									} else {
										oTable.AddRow();
									}
								} else if (subAction === 'add_column' || subAction === 'addColumn') {
									oTable.AddColumn();
								} else if (subAction === 'delete_row' || subAction === 'deleteRow') {
									var rowIndex = Number(oProps.rowIndex);
									oTable.RemoveRow(rowIndex);
								} else if (subAction === 'delete_column' || subAction === 'deleteColumn') {
									var colIndex = Number(oProps.colIndex);
									var oRow = oTable.GetRow(0);
									if (oRow) {
										var oCell = oRow.GetCell(colIndex);
										if (oCell) oCell.RemoveColumn();
									}
								} else if (subAction === 'merge_cells' || subAction === 'mergeCells') {
									var cellCoords = oProps.cells || [];
									var cellObjects = [];
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) cellObjects.push(cell);
									}
									if (cellObjects.length > 1) {
										oTable.MergeCells(cellObjects);
									}
								} else if (subAction === 'cell_shading' || subAction === 'cellShading') {
									var cellCoords = oProps.cells || [];
									var colorHex = oProps.color || "#ffffff";
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell && typeof cell.SetBackgroundColor === 'function') {
											cell.SetBackgroundColor(Api.HexColor(colorHex));
										}
									}
								} else if (subAction === 'cell_borders' || subAction === 'cellBorders') {
									var cellCoords = oProps.cells || [];
									var style = oProps.borderStyle || "single";
									var size = oProps.borderSize !== undefined ? Number(oProps.borderSize) : 8;
									var colorHex = oProps.borderColor || "#000000";
									var hex = String(colorHex).replace('#', '').trim();
									var r = 0, g = 0, b = 0;
									if (/^[0-9a-fA-F]{6}$/.test(hex)) {
										r = parseInt(hex.substring(0, 2), 16);
										g = parseInt(hex.substring(2, 4), 16);
										b = parseInt(hex.substring(4, 6), 16);
									}
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) {
											if (typeof cell.SetBorderBottom === 'function') cell.SetBorderBottom(style, size, 0, r, g, b);
											if (typeof cell.SetBorderLeft === 'function') cell.SetBorderLeft(style, size, 0, r, g, b);
											if (typeof cell.SetBorderRight === 'function') cell.SetBorderRight(style, size, 0, r, g, b);
											if (typeof cell.SetBorderTop === 'function') cell.SetBorderTop(style, size, 0, r, g, b);
										}
									}
								} else if (subAction === 'set_cell_text' || subAction === 'setCellText') {
									var cellCoords = oProps.cells || [];
									var textVal = oProps.newText || "";
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) {
											var cellContent = cell.GetContent();
											var cellParagraphs = cellContent.GetAllParagraphs();
											if (cellParagraphs && cellParagraphs.length > 0) {
												cellParagraphs[0].RemoveAllElements();
												cellParagraphs[0].AddText(textVal);
											} else {
												var oPara = Api.CreateParagraph();
												oPara.AddText(textVal);
												cellContent.AddElement(0, oPara);
											}
										}
									}
								}
							}
							return { delta: 0 };
						}, false, true, function(res) {
							var d = res ? (res.delta || 0) : 0;
							resolve({ delta: d });
						});
					} else {
						// formatting or rewriting
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							function applyPropertiesToElement(targetObj, props, targetType) {
								if (!targetObj) return;
								if (targetType === "run") {
									var oRange = targetObj;
									var isAlreadyTextPr = (targetObj.GetClassType && targetObj.GetClassType() === "textPr");
									
									if (!isAlreadyTextPr && typeof targetObj.GetRange === "function") {
										try {
											var r = targetObj.GetRange();
											if (r) oRange = r;
										} catch(e) {}
									}
									
									if (oRange) {
										if (props.fontName !== undefined) {
											try { if (oRange.SetFontName) oRange.SetFontName(props.fontName); } catch(e) {}
											try { if (oRange.SetFontFamily) oRange.SetFontFamily(props.fontName); } catch(e) {}
										}
										if (props.fontSize !== undefined) {
											try { if (oRange.SetFontSize) oRange.SetFontSize(props.fontSize); } catch(e) {}
										}
										if (props.bold !== undefined) {
											try { if (oRange.SetBold) oRange.SetBold(!!props.bold); } catch(e) {}
										}
										if (props.italic !== undefined) {
											try { if (oRange.SetItalic) oRange.SetItalic(!!props.italic); } catch(e) {}
										}
										if (props.underline !== undefined) {
											try { if (oRange.SetUnderline) oRange.SetUnderline(!!props.underline); } catch(e) {}
										}
										if (props.strikeout !== undefined) {
											try { if (oRange.SetStrikeout) oRange.SetStrikeout(!!props.strikeout); } catch(e) {}
										}
										if (props.doubleStrikeout !== undefined) {
											try { if (oRange.SetDoubleStrikeout) oRange.SetDoubleStrikeout(!!props.doubleStrikeout); } catch(e) {}
										}
										if (props.smallCaps !== undefined) {
											try { if (oRange.SetSmallCaps) oRange.SetSmallCaps(!!props.smallCaps); } catch(e) {}
										}
										if (props.caps !== undefined) {
											try { if (oRange.SetCaps) oRange.SetCaps(!!props.caps); } catch(e) {}
										}
										if (props.subscript !== undefined) {
											try { if (oRange.SetSubscript) oRange.SetSubscript(!!props.subscript); } catch(e) {}
										}
										if (props.superscript !== undefined) {
											try { if (oRange.SetSuperscript) oRange.SetSuperscript(!!props.superscript); } catch(e) {}
										}
										if (props.characterSpacing !== undefined) {
											try { if (oRange.SetSpacing) oRange.SetSpacing(props.characterSpacing); } catch(e) {}
										}
										
										if (props.highlight !== undefined) {
											try {
												var hl = props.highlight.toLowerCase().trim();
												var mappedHl = "none";
												if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
												else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
												else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
												else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
												else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
												else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
												else if (hl.indexOf("magenta") !== -1 || hl.indexOf("pink") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
												else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") mappedHl = "lightGray";
												else mappedHl = hl;
												
												try { if (oRange.SetHighlight) oRange.SetHighlight(mappedHl); } catch(e) {}
												
												if (typeof oRange.GetTextPr === "function" && typeof oRange.SetTextPr === "function") {
													try {
														var tp = oRange.GetTextPr();
														if (tp && tp.SetHighlight) {
															tp.SetHighlight(mappedHl);
															oRange.SetTextPr(tp);
														}
													} catch(eTp) {}
												}
											} catch(eHl) {}
										}
										
										if (props.color !== undefined) {
											try {
												var hex = String(props.color).replace('#', '').trim();
												var red = 0, green = 0, blue = 0;
												var isHex = /^[0-9a-fA-F]{6}$/.test(hex);
												if (isHex) {
													red = parseInt(hex.substring(0, 2), 16);
													green = parseInt(hex.substring(2, 4), 16);
													blue = parseInt(hex.substring(4, 6), 16);
												} else {
													var namedColors = {
														"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
														"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
														"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
													};
													if (namedColors[hex.toLowerCase()]) {
														var rgb = namedColors[hex.toLowerCase()];
														red = rgb[0]; green = rgb[1]; blue = rgb[2];
														isHex = true;
													}
												}
												
												if (isHex) {
													try { oRange.SetColor(red, green, blue); } catch(e) {}
													try {
														var colorObj = Api.CreateColorFromRGB(red, green, blue);
														oRange.SetColor(colorObj);
													} catch(eRGB) {}
												}
											} catch(eColorOuter) {}
										}
									}
								} else if (targetType === "paragraph") {
									var oParagraph = targetObj;
									try {
										if (props.alignment) {
											var jc = props.alignment;
											if (jc === "justify") jc = "both";
											if (typeof oParagraph.SetJc === "function") oParagraph.SetJc(jc);
										}
									} catch(e) {}
									try {
										var oParaPr = typeof oParagraph.GetParaPr === "function" ? oParagraph.GetParaPr() : null;
										if (oParaPr) {
											if (props.indLeft !== undefined && typeof oParaPr.SetIndLeft === "function") {
												oParaPr.SetIndLeft(Number(props.indLeft));
											}
											if (props.indRight !== undefined && typeof oParaPr.SetIndRight === "function") {
												oParaPr.SetIndRight(Number(props.indRight));
											}
											if (props.indFirstLine !== undefined && typeof oParaPr.SetIndFirstLine === "function") {
												oParaPr.SetIndFirstLine(Number(props.indFirstLine));
											}
										}
									} catch(eIndent) {}
									try { if (props.spacingAfter !== undefined && oParagraph.SetSpacingAfter) oParagraph.SetSpacingAfter(props.spacingAfter); } catch(e) {}
									try { if (props.spacingBefore !== undefined && oParagraph.SetSpacingBefore) oParagraph.SetSpacingBefore(props.spacingBefore); } catch(e) {}
									try {
										if (props.lineSpacing !== undefined && oParagraph.SetSpacingLine) {
											var rule = props.lineSpacingRule || "auto";
											var val = props.lineSpacingTwips || Math.round(props.lineSpacing * 240);
											oParagraph.SetSpacingLine(val, rule);
										}
									} catch(e) {}
									try {
										if (props.shading !== undefined && oParagraph.SetShd) {
											var hex = String(props.shading).replace('#', '').trim();
											if (/^[0-9a-fA-F]{6}$/.test(hex)) {
												var r = parseInt(hex.substring(0, 2), 16);
												var g = parseInt(hex.substring(2, 4), 16);
												var b = parseInt(hex.substring(4, 6), 16);
												try { oParagraph.SetShd(r, g, b); } catch(eShd) {
													try { oParagraph.SetShd(Api.CreateColorFromRGB(r, g, b)); } catch(errShd) {}
												}
											}
										}
									} catch(e) {}
								}
							}

							var parseAndApplyTextWithTags = function(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
								try { oPar.RemoveAllElements(); } catch(e) {}
								
								function applyFormatToRun(oRun, formatState) {
									if (!oRun) return;
									
									// 1. Direct ApiRun styling properties
									try {
										if (formatState.fontName) {
											if (typeof oRun.SetFontName === "function") oRun.SetFontName(formatState.fontName);
										}
										if (formatState.fontSize) {
											if (typeof oRun.SetFontSize === "function") oRun.SetFontSize(formatState.fontSize);
										}
										if (typeof oRun.SetBold === "function") oRun.SetBold(!!formatState.bold);
										if (typeof oRun.SetItalic === "function") oRun.SetItalic(!!formatState.italic);
										if (typeof oRun.SetUnderline === "function") oRun.SetUnderline(!!formatState.underline);
										if (typeof oRun.SetStrikeout === "function") oRun.SetStrikeout(!!formatState.strikeout);
										if (typeof oRun.SetDoubleStrikeout === "function") oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout);
										if (typeof oRun.SetSmallCaps === "function") oRun.SetSmallCaps(!!formatState.smallCaps);
										if (typeof oRun.SetCaps === "function") oRun.SetCaps(!!formatState.caps);
										if (typeof oRun.SetSubscript === "function") oRun.SetSubscript(!!formatState.subscript);
										if (typeof oRun.SetSuperscript === "function") oRun.SetSuperscript(!!formatState.superscript);
										if (formatState.characterSpacing && typeof oRun.SetSpacing === "function") oRun.SetSpacing(formatState.characterSpacing);
										
										if (formatState.highlight) {
											var hl = formatState.highlight.toLowerCase().trim();
											var mappedHl = "none";
											if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
											else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
											else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
											else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
											else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
											else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
											else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
											else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") mappedHl = "lightGray";
											else mappedHl = hl;
											if (typeof oRun.SetHighlight === "function") oRun.SetHighlight(mappedHl);
										}
										
										if (formatState.color) {
											var hex = String(formatState.color).replace('#', '').trim();
											if (/^[0-9a-fA-F]{6}$/.test(hex)) {
												var red = parseInt(hex.substring(0, 2), 16);
												var green = parseInt(hex.substring(2, 4), 16);
												var blue = parseInt(hex.substring(4, 6), 16);
												if (typeof oRun.SetColor === "function") {
													try { oRun.SetColor(red, green, blue); } catch(eC1) {}
													try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eC2) {}
												}
											} else {
												var namedColors = {
													"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
													"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
													"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
												};
												if (namedColors[hex.toLowerCase()]) {
													var rgb = namedColors[hex.toLowerCase()];
													if (typeof oRun.SetColor === "function") {
														try { oRun.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC3) {}
														try { oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC4) {}
													}
												}
											}
										}
									} catch(eRunDirect) {}

									// 2. Fallback to ApiRange transient/selection properties
									var oRunRange = oRun;
									try {
										var r = oRun.GetRange();
										if (r) oRunRange = r;
									} catch(e) {}
									
									if (formatState.fontName) {
										try { if (oRunRange.SetFontFamily) oRunRange.SetFontFamily(formatState.fontName); } catch(e) {}
										try { if (oRunRange.SetFontName) oRunRange.SetFontName(formatState.fontName); } catch(e) {}
									}
									if (formatState.fontSize) {
										try { if (oRunRange.SetFontSize) oRunRange.SetFontSize(formatState.fontSize); } catch(e) {}
									}
									try { if (oRunRange.SetBold) oRunRange.SetBold(!!formatState.bold); } catch(e) {}
									try { if (oRunRange.SetItalic) oRunRange.SetItalic(!!formatState.italic); } catch(e) {}
									try { if (oRunRange.SetUnderline) oRunRange.SetUnderline(!!formatState.underline); } catch(e) {}
									try { if (oRunRange.SetStrikeout) oRunRange.SetStrikeout(!!formatState.strikeout); } catch(e) {}
									try { if (oRunRange.SetDoubleStrikeout) oRunRange.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
									try { if (oRunRange.SetSmallCaps) oRunRange.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
									try { if (oRunRange.SetCaps) oRunRange.SetCaps(!!formatState.caps); } catch(e) {}
									try { if (oRunRange.SetSubscript) oRunRange.SetSubscript(!!formatState.subscript); } catch(e) {}
									try { if (oRunRange.SetSuperscript) oRunRange.SetSuperscript(!!formatState.superscript); } catch(e) {}
									try { if (formatState.characterSpacing && oRunRange.SetSpacing) oRunRange.SetSpacing(formatState.characterSpacing); } catch(e) {}
									
									if (formatState.highlight) {
										try {
											var hl = formatState.highlight.toLowerCase().trim();
											var mappedHl = "none";
											if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
											else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
											else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
											else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
											else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
											else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
											else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
											else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") mappedHl = "lightGray";
											else mappedHl = hl;
											
											try { if (oRunRange.SetHighlight) oRunRange.SetHighlight(mappedHl); } catch(e) {}
											
											if (typeof oRunRange.GetTextPr === "function" && typeof oRunRange.SetTextPr === "function") {
												try {
													var tp = oRunRange.GetTextPr();
													if (tp && tp.SetHighlight) {
														tp.SetHighlight(mappedHl);
														oRunRange.SetTextPr(tp);
													}
												} catch(eTp) {}
											}
										} catch(eHighlight) {}
									}
									
									if (formatState.color) {
										try {
											var hex = String(formatState.color).replace('#', '').trim();
											if (/^[0-9a-fA-F]{6}$/.test(hex)) {
												var red = parseInt(hex.substring(0, 2), 16);
												var green = parseInt(hex.substring(2, 4), 16);
												var blue = parseInt(hex.substring(4, 6), 16);
												try { oRunRange.SetColor(red, green, blue); } catch(eColor) {}
												try {
													var colorObj = Api.CreateColorFromRGB(red, green, blue);
													oRunRange.SetColor(colorObj);
												} catch(eColorRGB) {}
											} else {
												var namedColors = {
													"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
													"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
													"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
												};
												if (namedColors[hex.toLowerCase()]) {
													var rgb = namedColors[hex.toLowerCase()];
													try { oRunRange.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC) {}
													try { oRunRange.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC) {}
												}
											}
										} catch(eColorOuter) {}
									}
								}

								if (htmlStr) {
									htmlStr = htmlStr
										.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
										.replace(/__(.*?)__/g, '<b>$1</b>')
										.replace(/\*(.*?)\*/g, '<i>$1</i>')
										.replace(/_(.*?)_/g, '<i>$1</i>');
								}
								var regex = /(<[^>]+>)/g;
								var parts = String(htmlStr || "").split(regex);
								var formatState = {
									fontName: pProps.fontName || defFont || "Calibri",
									fontSize: pProps.fontSize || defSize || 22,
									bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
									italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
									underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
									strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
									doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
									smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
									caps: pProps.caps !== undefined ? pProps.caps : false,
									subscript: pProps.subscript !== undefined ? pProps.subscript : false,
									superscript: pProps.superscript !== undefined ? pProps.superscript : false,
									characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
									color: pProps.color || defColorHex || "#000000",
									highlight: pProps.highlight || defHighlight || "none"
								};

								if (!htmlStr) {
									var oRun = null;
									try { oRun = oPar.AddText(""); } catch(eText) {}
									if (oRun) {
										applyFormatToRun(oRun, formatState);
									}
									return;
								}

								var stateStack = [JSON.parse(JSON.stringify(formatState))];
								for (var idx = 0; idx < parts.length; idx++) {
									var part = parts[idx];
									if (!part) continue;
									if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
										var tagLower = part.toLowerCase();
										if (tagLower.indexOf("</") === 0) {
											if (stateStack.length > 1) {
												stateStack.pop();
												formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
											}
										} else {
											var newState = JSON.parse(JSON.stringify(formatState));
											if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
												newState.bold = true;
											} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
												newState.italic = true;
											} else if (tagLower.indexOf("<u") === 0) {
												newState.underline = true;
											} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || /^<s[> \/]/i.test(tagLower)) {
												newState.strikeout = true;
											} else if (tagLower.indexOf("<sub>") === 0) {
												newState.subscript = true;
												newState.superscript = false;
											} else if (tagLower.indexOf("<sup>") === 0) {
												newState.superscript = true;
												newState.subscript = false;
											} else if (tagLower.indexOf("<small>") === 0) {
												newState.smallCaps = true;
											} else if (tagLower.indexOf("<big>") === 0) {
												newState.caps = true;
												newState.fontSize = Math.round(newState.fontSize * 1.2);
											} else if (tagLower.indexOf("<font") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												if (match && match[1]) newState.color = match[1];
												var matchFace = part.match(/face=["']([^"']+)["']/i);
												if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
												var matchSize = part.match(/size=["']([^"']+)["']/i);
												if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
											} else if (tagLower.indexOf("<mark") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (match && match[1]) {
													newState.highlight = match[1];
												} else if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													var foundBg = false;
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'background-color' || propName === 'background' || propName === 'color') {
																newState.highlight = propVal;
																foundBg = true;
															}
														}
													}
													if (!foundBg) newState.highlight = "yellow";
												} else {
													newState.highlight = "yellow";
												}
											} else if (tagLower.indexOf("<span") === 0) {
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'font-weight') {
																if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
																else if (propVal === 'normal' || propVal === '400') newState.bold = false;
															} else if (propName === 'font-style') {
																if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
																else if (propVal === 'normal') newState.italic = false;
															} else if (propName === 'text-decoration') {
																if (propVal.indexOf('underline') !== -1) newState.underline = true;
																if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
																if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
															} else if (propName === 'color') {
																newState.color = propVal;
															} else if (propName === 'background-color' || propName === 'background') {
																newState.highlight = propVal;
															} else if (propName === 'font-family') {
																newState.fontName = propVal.replace(/['"]/g, '').trim();
															} else if (propName === 'font-size') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.fontSize = Math.round(numVal * 2);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.fontSize = Math.round(numVal * 1.5);
																}
															} else if (propName === 'letter-spacing') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 20);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 15);
																} else {
																	newState.characterSpacing = Math.round(numVal);
																}
															} else if (propName === 'text-transform') {
																if (propVal === 'uppercase') newState.caps = true;
																else if (propVal === 'lowercase') newState.caps = false;
															} else if (propName === 'font-variant') {
																if (propVal === 'small-caps') newState.smallCaps = true;
															} else if (propName === 'vertical-align') {
																if (propVal === 'super') {
																	newState.superscript = true;
																	newState.subscript = false;
																} else if (propVal === 'sub') {
																	newState.subscript = true;
																	newState.superscript = false;
																}
															}
														}
													}
												}
											}
											stateStack.push(newState);
											formatState = newState;
										}
									} else {
										var decText = part
											.replace(/&quot;/g, '"')
											.replace(/&lt;/g, '<')
											.replace(/&gt;/g, '>')
											.replace(/&amp;/g, '&')
											.replace(/&#39;/g, "'")
											.replace(/&apos;/g, "'");
										var oRun = null;
										try { oRun = oPar.AddText(decText); } catch(eText) {}
										if (oRun) {
											applyFormatToRun(oRun, formatState);
										}
									}
								}
							};
							
							// Clamp index to prevent out-of-bounds target formatting references
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							
							var origFont = "Calibri";
							var origSize = 22;
							var origBold = false;
							var origItalic = false;
							var origUnderline = false;
							var origStrikeout = false;
							var origColorHex = "#000000";
							var origHighlight = "none";
							
							if (oParagraph) {
								try {
									var runCount = oParagraph.GetElementsCount();
									if (runCount > 0) {
										var firstRun = oParagraph.GetElement(0);
										if (firstRun) {
											var textPr = null;
											try { if (typeof firstRun.GetTextPr === "function") textPr = firstRun.GetTextPr(); } catch(e) {}
											if (textPr) {
												try { 
													if (typeof textPr.GetFontFamily === "function") {
														origFont = textPr.GetFontFamily() || origFont;
													} else if (typeof textPr.GetFontName === "function") {
														origFont = textPr.GetFontName() || origFont;
													}
												} catch(e) {}
												try { if (typeof textPr.GetFontSize === "function") origSize = textPr.GetFontSize() || origSize; } catch(e) {}
												try { if (typeof textPr.GetBold === "function") origBold = textPr.GetBold() || origBold; } catch(e) {}
												try { if (typeof textPr.GetItalic === "function") origItalic = textPr.GetItalic() || origItalic; } catch(e) {}
												try { if (typeof textPr.GetUnderline === "function") origUnderline = !!textPr.GetUnderline(); } catch(e) {}
												try { if (typeof textPr.GetStrikeout === "function") origStrikeout = !!textPr.GetStrikeout(); } catch(e) {}
												try {
													if (typeof textPr.GetColor === "function") {
														var c = textPr.GetColor();
														if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
													}
												} catch(e) {}
												try {
													if (typeof textPr.GetHighlight === "function") {
														var hl = textPr.GetHighlight();
														if (hl) {
															if (typeof hl === "string") origHighlight = hl;
															else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
														}
													}
												} catch(e) {}
											}
										}
									}
									if ((origFont === "Calibri" || !origFont) && typeof oParagraph.GetTextPr === "function") {
										var pTp = oParagraph.GetTextPr();
										if (pTp) {
											try {
												if (typeof pTp.GetFontFamily === "function") {
													origFont = pTp.GetFontFamily() || origFont;
												} else if (typeof pTp.GetFontName === "function") {
													origFont = pTp.GetFontName() || origFont;
												}
											} catch(e) {}
											try { if (typeof pTp.GetFontSize === "function") origSize = pTp.GetFontSize() || origSize; } catch(e) {}
											try { if (typeof pTp.GetBold === "function") origBold = pTp.GetBold() || origBold; } catch(e) {}
											try { if (typeof pTp.GetItalic === "function") origItalic = pTp.GetItalic() || origItalic; } catch(e) {}
											try { if (typeof pTp.GetUnderline === "function") origUnderline = !!pTp.GetUnderline(); } catch(e) {}
											try { if (typeof pTp.GetStrikeout === "function") origStrikeout = !!pTp.GetStrikeout(); } catch(e) {}
											try {
												if (typeof pTp.GetColor === "function") {
													var c = pTp.GetColor();
													if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
												}
											} catch(e) {}
											try {
												if (typeof pTp.GetHighlight === "function") {
													var hl = pTp.GetHighlight();
													if (hl) {
														if (typeof hl === "string") origHighlight = hl;
														else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
													}
												}
											} catch(e) {}
										}
									}
								} catch(e) {}
							}
								
								try { oParagraph.Select(); } catch(e) {}
								
								var oProps = change.properties || {};
								try {
									if (oProps.newText !== undefined) {
										parseAndApplyTextWithTags(oParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, origHighlight, oProps);
									} else {
										// If in selection mode and a valid Range exists, apply run formatting directly to the active range!
										var oRange = null;
										try { oRange = oDocument.GetRangeBySelect(); } catch(e) {}
										var isSelectionMode = (change.mode === 'selection' || (cachedDocData && cachedDocData.mode === 'selection'));
										
										if (isSelectionMode && oRange && (oRange.GetText() || "").trim().length > 0) {
											applyPropertiesToElement(oRange, oProps, "run");
										} else {
											// Apply formatting directly to the paragraph object
											try {
												applyPropertiesToElement(oParagraph, oProps, "run");
											} catch(e) {}

											// Apply paragraph-level range formatting
											try {
												var oParagraphRange = oParagraph.GetRange();
												if (oParagraphRange) {
													applyPropertiesToElement(oParagraphRange, oProps, "run");
												}
											} catch(e) {}

											// Format paragraph default text properties using a new ApiTextPr
											try {
												var pTp = Api.CreateTextPr();
												applyPropertiesToElement(pTp, oProps, "run");
												if (typeof oParagraph.SetTextPr === "function") {
													oParagraph.SetTextPr(pTp);
												}
											} catch(e) {}

											// Fallback to applying styles to all runs of the paragraph
											var runCount = oParagraph.GetElementsCount();
											for (var r = 0; r < runCount; r++) {
												var oRun = oParagraph.GetElement(r);
												if (oRun && oRun.GetClassType() === "run") {
													try {
														applyPropertiesToElement(oRun, oProps, "run");
													} catch(e) {}
												}
											}
										}
									}
								} catch(e) {}

								// Apply paragraph-level styling
								try {
									applyPropertiesToElement(oParagraph, oProps, "paragraph");
								} catch(e) {}

								// Apply document/section layout properties
								try {
									var section = null;
									if (typeof oDocument.GetDefaultSection === "function") {
										section = oDocument.GetDefaultSection();
									} else {
										var secs = typeof oDocument.GetSections === "function" ? oDocument.GetSections() : null;
										if (secs && secs.length > 0) section = secs[0];
									}
									if (section) {
										if (oProps.pageOrientation !== undefined) {
											if (oProps.pageOrientation === "landscape") {
												try { section.SetPageOrientation("landscape"); } catch(e) {}
											} else {
												try { section.SetPageOrientation("portrait"); } catch(e) {}
											}
										}
										if (oProps.pageWidth !== undefined && oProps.pageHeight !== undefined) {
											try { section.SetPageSize(Number(oProps.pageWidth), Number(oProps.pageHeight)); } catch(e) {}
										}
										var mLeft = oProps.marginLeft !== undefined ? Number(oProps.marginLeft) : null;
										var mRight = oProps.marginRight !== undefined ? Number(oProps.marginRight) : null;
										var mTop = oProps.marginTop !== undefined ? Number(oProps.marginTop) : null;
										var mBottom = oProps.marginBottom !== undefined ? Number(oProps.marginBottom) : null;
										if (mLeft !== null || mRight !== null || mTop !== null || mBottom !== null) {
											try {
												if (mLeft !== null && section.SetMarginLeft) section.SetMarginLeft(mLeft);
												if (mRight !== null && section.SetMarginRight) section.SetMarginRight(mRight);
												if (mTop !== null && section.SetMarginTop) section.SetMarginTop(mTop);
												if (mBottom !== null && section.SetMarginBottom) section.SetMarginBottom(mBottom);
											} catch(eMarg) {}
										}
										if (oProps.columnsCount !== undefined) {
											try {
												if (typeof section.SetEqualColumns === "function") {
													var spacing = oProps.columnsSpacing !== undefined ? Number(oProps.columnsSpacing) : 720;
													section.SetEqualColumns(Number(oProps.columnsCount), spacing);
												}
											} catch(eCol) {}
										}
									}
								} catch(eLayout) {}
								return "success";
							}, false, true, function() {
								resolve({ delta: 0 });
							});
					}
				});
			}

			// Apply edit command
			const editResult = await runEditCommand();

			// Tiny settle delay for structural modifications to let ONLYOFFICE asynchronous layout loops complete
			if (actionName.indexOf('paragraph') !== -1 || actionName.indexOf('html') !== -1 || actionName.indexOf('Paragraph') !== -1 || actionName.indexOf('HTML') !== -1) {
				await new Promise(r => setTimeout(r, 60));
			}

			// Capture element state after applying change
			const afterState = await captureElementState(actualTargetIndex);

			// Verification logic check
			const verification = verifyChange(change, beforeState, afterState, editResult);

			if (verification.success) {
				log(`Action [${actionName.toUpperCase()}] executed and VERIFIED successfully!`, 'success');
				
				// Append final successful stateAfter
				lastExecutionDebugData.stateAfter.push({
					stepIndex: i,
					action: actionName,
					targetIndex: targetIndex,
					actualIndex: actualTargetIndex,
					state: afterState,
					verification: verification
				});
				if (typeof updateDebugViewer === 'function') updateDebugViewer();

				modifications.push({
					action: actionName,
					targetIndex: targetIndex,
					actualTargetIndex: actualTargetIndex,
					delta: editResult.delta
				});
				retryCount = 0; 
				i++;
				setTimeout(applyNext, 300);
			} else {
				log(`Verification FAILED for action [${actionName.toUpperCase()}]: ${verification.reason}`, 'warning');
				retryCount++;
				if (retryCount < maxRetries) {
					log(`Retrying action [${actionName.toUpperCase()}] in 1000ms...`, 'info');
					setTimeout(applyNext, 1000);
				} else {
					log(`Action [${actionName.toUpperCase()}] failed verification after ${maxRetries} attempts. Proceeding anyway to preserve workflow continuity.`, 'error');
					
					// Append final fallback stateAfter
					lastExecutionDebugData.stateAfter.push({
						stepIndex: i,
						action: actionName,
						targetIndex: targetIndex,
						actualIndex: actualTargetIndex,
						state: afterState,
						verification: verification
					});
					if (typeof updateDebugViewer === 'function') updateDebugViewer();

					modifications.push({
						action: actionName,
						targetIndex: targetIndex,
						actualTargetIndex: actualTargetIndex,
						delta: editResult.delta
					});
					retryCount = 0; 
					i++;
					setTimeout(applyNext, 300);
				}
			}
		} catch (err) {
				log(`Error executing autonomous edits at step ${i}: ${err.message}`, 'error');
				setStepperStep(3, "failed", err.message);
				isEditingAutonomously = false;
				lastInternalQueryTime = Date.now();
				executeBtn.disabled = false;
				proposedChanges = null;
			}
		}

		// HTML Tag Parser
		function parseAndApplyTextWithTags(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
			try { oPar.RemoveAllElements(); } catch(e) {}
			
			function applyFormatToRun(oRun, formatState) {
				if (!oRun) return;
				
				// 1. Direct ApiRun styling properties
				try {
					if (formatState.fontName) {
						if (typeof oRun.SetFontName === "function") oRun.SetFontName(formatState.fontName);
					}
					if (formatState.fontSize) {
						if (typeof oRun.SetFontSize === "function") oRun.SetFontSize(formatState.fontSize);
					}
					if (typeof oRun.SetBold === "function") oRun.SetBold(!!formatState.bold);
					if (typeof oRun.SetItalic === "function") oRun.SetItalic(!!formatState.italic);
					if (typeof oRun.SetUnderline === "function") oRun.SetUnderline(!!formatState.underline);
					if (typeof oRun.SetStrikeout === "function") oRun.SetStrikeout(!!formatState.strikeout);
					if (typeof oRun.SetDoubleStrikeout === "function") oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout);
					if (typeof oRun.SetSmallCaps === "function") oRun.SetSmallCaps(!!formatState.smallCaps);
					if (typeof oRun.SetCaps === "function") oRun.SetCaps(!!formatState.caps);
					if (typeof oRun.SetSubscript === "function") oRun.SetSubscript(!!formatState.subscript);
					if (typeof oRun.SetSuperscript === "function") oRun.SetSuperscript(!!formatState.superscript);
					if (formatState.characterSpacing && typeof oRun.SetSpacing === "function") oRun.SetSpacing(formatState.characterSpacing);
					
					if (formatState.highlight) {
						var hl = formatState.highlight.toLowerCase().trim();
						var mappedHl = "none";
						if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
						else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
						else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
						else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
						else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
						else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
						else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
						else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") mappedHl = "lightGray";
						else mappedHl = hl;
						if (typeof oRun.SetHighlight === "function") oRun.SetHighlight(mappedHl);
					}
					
					if (formatState.color) {
						var hex = String(formatState.color).replace('#', '').trim();
						if (/^[0-9a-fA-F]{6}$/.test(hex)) {
							var red = parseInt(hex.substring(0, 2), 16);
							var green = parseInt(hex.substring(2, 4), 16);
							var blue = parseInt(hex.substring(4, 6), 16);
							if (typeof oRun.SetColor === "function") {
								try { oRun.SetColor(red, green, blue); } catch(eC1) {}
								try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eC2) {}
							}
						} else {
							var namedColors = {
								"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
								"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
								"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
							};
							if (namedColors[hex.toLowerCase()]) {
								var rgb = namedColors[hex.toLowerCase()];
								if (typeof oRun.SetColor === "function") {
									try { oRun.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC3) {}
									try { oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC4) {}
								}
							}
						}
					}
				} catch(eRunDirect) {}

				// 2. Fallback to ApiRange transient/selection properties
				var oRunRange = oRun;
				try {
					var r = oRun.GetRange();
					if (r) oRunRange = r;
				} catch(e) {}
				
				if (formatState.fontName) {
					try { if (oRunRange.SetFontFamily) oRunRange.SetFontFamily(formatState.fontName); } catch(e) {}
					try { if (oRunRange.SetFontName) oRunRange.SetFontName(formatState.fontName); } catch(e) {}
				}
				if (formatState.fontSize) {
					try { if (oRunRange.SetFontSize) oRunRange.SetFontSize(formatState.fontSize); } catch(e) {}
				}
				try { if (oRunRange.SetBold) oRunRange.SetBold(!!formatState.bold); } catch(e) {}
				try { if (oRunRange.SetItalic) oRunRange.SetItalic(!!formatState.italic); } catch(e) {}
				try { if (oRunRange.SetUnderline) oRunRange.SetUnderline(!!formatState.underline); } catch(e) {}
				try { if (oRunRange.SetStrikeout) oRunRange.SetStrikeout(!!formatState.strikeout); } catch(e) {}
				try { if (oRunRange.SetDoubleStrikeout) oRunRange.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
				try { if (oRunRange.SetSmallCaps) oRunRange.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
				try { if (oRunRange.SetCaps) oRunRange.SetCaps(!!formatState.caps); } catch(e) {}
				try { if (oRunRange.SetSubscript) oRunRange.SetSubscript(!!formatState.subscript); } catch(e) {}
				try { if (oRunRange.SetSuperscript) oRunRange.SetSuperscript(!!formatState.superscript); } catch(e) {}
				try { if (formatState.characterSpacing && oRunRange.SetSpacing) oRunRange.SetSpacing(formatState.characterSpacing); } catch(e) {}
				
				if (formatState.highlight) {
					try {
						var hl = formatState.highlight.toLowerCase().trim();
						var mappedHl = "none";
						if (hl === "none" || hl === "null" || hl === "default") mappedHl = "none";
						else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") mappedHl = "yellow";
						else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") mappedHl = "green";
						else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") mappedHl = "blue";
						else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") mappedHl = "cyan";
						else if (hl.indexOf("red") !== -1 || hl === "#ff0000") mappedHl = "red";
						else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") mappedHl = "magenta";
						else if (hl.indexOf("gray") !== -1 || hl === "#grey" || hl === "#808080") mappedHl = "lightGray";
						else mappedHl = hl;
						
						try { if (oRunRange.SetHighlight) oRunRange.SetHighlight(mappedHl); } catch(e) {}
						
						if (typeof oRunRange.GetTextPr === "function" && typeof oRunRange.SetTextPr === "function") {
							try {
								var tp = oRunRange.GetTextPr();
								if (tp && tp.SetHighlight) {
									tp.SetHighlight(mappedHl);
									oRunRange.SetTextPr(tp);
								}
							} catch(eTp) {}
						}
					} catch(eHighlight) {}
				}
				
				if (formatState.color) {
					try {
						var hex = String(formatState.color).replace('#', '').trim();
						if (/^[0-9a-fA-F]{6}$/.test(hex)) {
							var red = parseInt(hex.substring(0, 2), 16);
							var green = parseInt(hex.substring(2, 4), 16);
							var blue = parseInt(hex.substring(4, 6), 16);
							try { oRunRange.SetColor(red, green, blue); } catch(eColor) {}
							try {
								var colorObj = Api.CreateColorFromRGB(red, green, blue);
								oRunRange.SetColor(colorObj);
							} catch(eColorRGB) {}
						} else {
							var namedColors = {
								"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
								"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
								"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
							};
							if (namedColors[hex.toLowerCase()]) {
								var rgb = namedColors[hex.toLowerCase()];
								try { oRunRange.SetColor(rgb[0], rgb[1], rgb[2]); } catch(eC) {}
								try { oRunRange.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2])); } catch(eC) {}
							}
						}
					} catch(eColorOuter) {}
				}
			}

			if (htmlStr) {
				htmlStr = htmlStr
					.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
					.replace(/__(.*?)__/g, '<b>$1</b>')
					.replace(/\*(.*?)\*/g, '<i>$1</i>')
					.replace(/_(.*?)_/g, '<i>$1</i>');
			}
			var regex = /(<[^>]+>)/g;
			var parts = String(htmlStr || "").split(regex);
			var formatState = {
				fontName: pProps.fontName || defFont || "Calibri",
				fontSize: pProps.fontSize || defSize || 22,
				bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
				italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
				underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
				strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
				doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
				smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
				caps: pProps.caps !== undefined ? pProps.caps : false,
				subscript: pProps.subscript !== undefined ? pProps.subscript : false,
				superscript: pProps.superscript !== undefined ? pProps.superscript : false,
				characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
				color: pProps.color || defColorHex || "#000000",
				highlight: pProps.highlight || defHighlight || "none"
			};

			if (!htmlStr) {
				var oRun = null;
				try { oRun = oPar.AddText(""); } catch(eText) {}
				if (oRun) {
					applyFormatToRun(oRun, formatState);
				}
				return;
			}

			var stateStack = [JSON.parse(JSON.stringify(formatState))];
			
			for (var idx = 0; idx < parts.length; idx++) {
				var part = parts[idx];
				if (!part) continue;
				
				if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
					var tagLower = part.toLowerCase();
					if (tagLower.indexOf("</") === 0) {
						if (stateStack.length > 1) {
							stateStack.pop();
							formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
						}
					} else {
						var newState = JSON.parse(JSON.stringify(formatState));
						if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
							newState.bold = true;
						} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
							newState.italic = true;
						} else if (tagLower.indexOf("<u") === 0) {
							newState.underline = true;
						} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || /^<s[> \/]/i.test(tagLower)) {
							newState.strikeout = true;
						} else if (tagLower.indexOf("<sub>") === 0) {
							newState.subscript = true;
							newState.superscript = false;
						} else if (tagLower.indexOf("<sup>") === 0) {
							newState.superscript = true;
							newState.subscript = false;
						} else if (tagLower.indexOf("<small>") === 0) {
							newState.smallCaps = true;
						} else if (tagLower.indexOf("<big>") === 0) {
							newState.caps = true;
							newState.fontSize = Math.round(newState.fontSize * 1.2);
						} else if (tagLower.indexOf("<font") === 0) {
							var match = part.match(/color=["']([^"']+)["']/i);
							if (match && match[1]) newState.color = match[1];
							var matchFace = part.match(/face=["']([^"']+)["']/i);
							if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
							var matchSize = part.match(/size=["']([^"']+)["']/i);
							if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
						} else if (tagLower.indexOf("<mark") === 0) {
							var match = part.match(/color=["']([^"']+)["']/i);
							var styleMatch = part.match(/style=["']([^"']+)["']/i);
							if (match && match[1]) {
								newState.highlight = match[1];
							} else if (styleMatch && styleMatch[1]) {
								var styleStr = styleMatch[1];
								var declarations = styleStr.split(';');
								var foundBg = false;
								for (var d = 0; d < declarations.length; d++) {
									var dec = declarations[d].trim();
									if (!dec) continue;
									var pSplit = dec.split(':');
									if (pSplit.length >= 2) {
										var propName = pSplit[0].trim().toLowerCase();
										var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
										if (propName === 'background-color' || propName === 'background' || propName === 'color') {
											newState.highlight = propVal;
											foundBg = true;
										}
									}
								}
								if (!foundBg) newState.highlight = "yellow";
							} else {
								newState.highlight = "yellow";
							}
						} else if (tagLower.indexOf("<span") === 0) {
							var styleMatch = part.match(/style=["']([^"']+)["']/i);
							if (styleMatch && styleMatch[1]) {
								var styleStr = styleMatch[1];
								var declarations = styleStr.split(';');
								for (var d = 0; d < declarations.length; d++) {
									var dec = declarations[d].trim();
									if (!dec) continue;
									var pSplit = dec.split(':');
									if (pSplit.length >= 2) {
										var propName = pSplit[0].trim().toLowerCase();
										var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
										
										if (propName === 'font-weight') {
											if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
											else if (propVal === 'normal' || propVal === '400') newState.bold = false;
										} else if (propName === 'font-style') {
											if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
											else if (propVal === 'normal') newState.italic = false;
										} else if (propName === 'text-decoration') {
											if (propVal.indexOf('underline') !== -1) newState.underline = true;
											if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
											if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
										} else if (propName === 'color') {
											newState.color = propVal;
										} else if (propName === 'background-color' || propName === 'background') {
											newState.highlight = propVal;
										} else if (propName === 'font-family') {
											newState.fontName = propVal.replace(/['"]/g, '').trim();
										} else if (propName === 'font-size') {
											var numVal = parseFloat(propVal);
											if (propVal.indexOf('pt') !== -1) {
												newState.fontSize = Math.round(numVal * 2);
											} else if (propVal.indexOf('px') !== -1) {
												newState.fontSize = Math.round(numVal * 1.5);
											}
										} else if (propName === 'letter-spacing') {
											var numVal = parseFloat(propVal);
											if (propVal.indexOf('pt') !== -1) {
												newState.characterSpacing = Math.round(numVal * 20);
											} else if (propVal.indexOf('px') !== -1) {
												newState.characterSpacing = Math.round(numVal * 15);
											} else {
												newState.characterSpacing = Math.round(numVal);
											}
										} else if (propName === 'text-transform') {
											if (propVal === 'uppercase') newState.caps = true;
											else if (propVal === 'lowercase') newState.caps = false;
										} else if (propName === 'font-variant') {
											if (propVal === 'small-caps') newState.smallCaps = true;
										} else if (propName === 'vertical-align') {
											if (propVal === 'super') {
												newState.superscript = true;
												newState.subscript = false;
											} else if (propVal === 'sub') {
												newState.subscript = true;
												newState.superscript = false;
											}
										}
									}
								}
							}
						}
						stateStack.push(newState);
						formatState = newState;
					}
				} else {
					var decText = part
						.replace(/&quot;/g, '"')
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&amp;/g, '&')
						.replace(/&#39;/g, "'")
						.replace(/&apos;/g, "'");
						
					var oRun = null;
					try { oRun = oPar.AddText(decText); } catch(eText) {}
					if (oRun) {
						applyFormatToRun(oRun, formatState);
					}
				}
			}
		}

		applyNext();
	}

})(window);
