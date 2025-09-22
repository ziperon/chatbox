const changelog = `
## v1.15.4 - 2025.08.12

1. Fix mobile "Improve Network Compatibility" feature, support cross-domain API requests
2. OpenAI provider added support for gpt-5 series models
3. Mobile full-screen preview artifacts
4. Fix issue where input box draft was not cleared immediately after sending a message
5. Sidebar support on iOS

## v1.15.3 - 2025.08.06

1. Optimize streaming output display
2. Fix message edit box width
3. Fix input box keyboard pop-up trigger condition
4. Fix message count limit reset issue
5. Optimize App system compatibility, now supports lower system versions
6. Shorten the display time of the copied prompt
7. Model list supports search
8. Input box automatically saves draft
9. Add mistral provider
10. Show thinking time
11. New conversation defaults to hiding my partner list, can be enabled in my partner page

Thanks to @wc222, @julienheinen for their contributions

## v1.15.2 - 2025.07.24

1. Fixed issue where maxTokens parameter was missing in some clients, causing message sending to fail
2. Fixed issue where thinking content couldn't be edited
3. Fixed issue where third-party embedding API call failed in knowledge base
4. Fixed issue where some API providers returned empty thinking content, causing multiple thinking content to appear

## v1.15.1 - 2025.07.22

1. Support disabling streaming output
2. Support setting max token parameter
3. Fix issue where mobile couldn't access ollama
4. Adjust input box style
5. Support importing MCP and provider configurations through deep link
6. Fix issue where new conversation message was not sent in some conditions

### v1.15.0 - 2025.07.07

1. Local knowledge base support
2. Adjust thinking and tool call message style

### v1.14.4 - 2025.07.03

1. Fixed issue where editing in conversation list would cause the app to crash

### v1.14.3 - 2025.06.28

1. Fixed issue where exporting data on mobile would cause a crash
2. Added global model parameter settings
3. Fixed some markdown and Latex display issues
4. Fixed issue where some OpenRouter models didn't show thinking content
5. Compatible with MCP environment variables containing = characterss

Thanks to @jakub-nezasa for their contributions

### v1.14.2 - 2025.06.19

1. Fixed issue where pressing Enter for a new line on mobile would send the message immediately
2. Fixed issue where send button was disabled on some devices
3. Adjusted new thread button size

### v1.14.1 - 2025.06.16

1. Fixed issue where provider settings were lost after restarting the app

### v1.14.0 - 2025.06.16

1. Desktop support MCP
2. New home page design
3. Add VolcEngine model provider
4. Fix issue where custom temperature was invalid in Azure, now you can set the temperature of o-series models to 1
5. Fix shortcut key error on non-QWERT keyboard

Thanks to @Fr0benius for their contributions

### v1.13.4 - 2025.06.09

1. Fixed storage performance issue
2. Fixed issue where clearing conversation list in English language couldn't fill in the number of conversations to keep

### v1.13.3 - 2025.06.08

1. Fixed issue where custom provider couldn't set API Path
2. OpenAI, Claude, Gemini models support setting thinking effort parameter

### v1.13.2 - 2025.05.30

1. Fixed window can't be dragged on session title bar

### v1.13.1 - 2025.05.28

1. Refactor settings UI
2. Quick switch to different model provider in chat session
3. Fix a bug in moving thread to session
4. Fix a bug in conversation search
5. Fix a bug in auto scroll issue
6. Optimize window height calculation performance, improve mobile keyboard pop-up speed
7. Fix some style issues on small screen

Thanks to @xiaoxiaowesley, @chaoliu719, @Jesse205, @trrahul for their contributions

### v1.12.3 - 2025.05.08

1. Fixed issue where data was lost when upgrading from 1.9.x version on mobile
2. Mac: Use Command key instead of Ctrl key for shortcut functions

### v1.12.2 - 2025.04.29

1. Fixed initialization data migration performance issue

### v1.12.1 - 2025.04.28

1. Fixed Latex rendering issue
2. Fixed left sidebar top drag issue
3. Fixed ChatboxAI error message display
4. Added initialization process log display

### v1.12.0 - 2025.04.24

1. Chatbox AI supports Gemini multimodal output
2. Fixed issue where the web browsing switch was not synchronized when regenerating messages
3. Improved desktop UI, removing native titlebar
4. Optimized mobile storage performance
5. Import backups now merge conversation lists instead of overwriting
6. Update new thread icon

### v1.11.12 - 2025.04.15

1. Fixed claude api host issue

### v1.11.11 - 2025.04.15

1. Fixed issue with web browsing

### v1.11.10 - 2025.04.15

1. Improved update checking experience
2. Fixed auto update downgrade issue
3. Fixed model vision ability check issue
4. Fixed issue where new session was not selected after creating from a copilot
5. Submit button changed to be stop button when generating message
6. Improved error message display for API errors

### v1.11.8 - 2025.04.05

1. Fixed an issue with custom Gemini API host

### v1.11.7 - 2025.04.04

1. Added support for Gemini multimodal output
2. Added more context window size options
3. Auto-collapse deep thought output content
4. Adjusted auto-update check frequency
5. Fixed some model tool calling issues
6. Fixed ollama image understanding support

### v1.11.5 - 2025.03.28

1. Fixed XAI only supporting Grok-Beta model, now works with other models
2. Fixed some models not showing chain-of-thought during inference
3. Fixed an issue where the app wouldn't close properly in certain cases
4. Improved web browsing experience on mobile devices for better stability and smoothness
5. Other performance optimizations and bug fixes

### v1.11.3 - 2025.03.24

1. Refactor Settings UI
2. Fixed some issues with LLM API calling
3. Fixed model temperature and topP parameter

### v1.10.7 - 2025.03.17

1. Added beta update channel, can be enabled in settings

### v1.10.5 - 2025.03.10

1. Improved model setting UI
2. Added api version setting for azure openai
3. Fixed message formatting issue for some providers
4. Improved web search icon

### v1.10.4 - 2025.03.01


1. Update web browsing search engine

### v1.10.2 - 2025.02.28

1. Support web browsing for all provider

### v1.10.1 - 2025.02.28

1. Fix an issue with web browsing

### v1.10.0 - 2025.02.24

1. Web browsing now supports any OpenAI-compatible model! This feature is ready to use without additional API configuration (desktop client only)

### v1.9.8 - 2025.02.06

1. Fixed image recognition issues in o1
2. Updated Perplexity model list with chain-of-thought support
3. Fixed various display issues

### v1.9.7 - 2025.02.03

1. Improved the chain-of-thought display for the DeepSeek R1 model in SiliconFlow.  
2. Enhanced the chain-of-thought display for the DeepSeek R1 model in LM Studio.  
3. Increased the maximum number of files attachable in messages to 10.  
4. Added support for o1 and o3 series models deployed on Azure.  
5. Introduced support for the new o3-mini model.  

### v1.9.5 - 2025.01.28

1.  Fixed some minor issues.

### v1.9.3 - 2025.01.26

1.  Added local document analysis. Now you can send files like PDFs, DOCs, PPTs, and XLSXs to any model API.
2.  Added the option to collapse the thought process for the DeepSeek-R1 model when deployed via Ollama.
3.  Fixed an issue with line breaks in the thought process display.
4.  Fixed issues caused by shortcut key settings.
5.  Fixed other minor issues.

### v1.9.1 - 2025.01.20

1. Added support for the DeepSeek R1 model.
2. Enabled display of the model's thought process (if supported by the model).
3. Fixed the issue where Artifact previews failed due to network problems.

### v1.9.0 - 2025.01.18

1. Added DeepSeek as a model provider
2. Added xAI as a model provider
3. Added LM Studio as a model provider
4. Added Perplexity as a model provider
5. Added SiliconFlow as a model provider
6. Added shortcut key customization feature with recording capability
7. Scroll position is now remembered when switching between conversations
8. Added option to disable automatic software updates
9. Long pasted text now inserts as a file (can be disabled in settings)
10. Hold Shift while clicking the delete button to bypass confirmation
11. Added Ctrl+E shortcut for quick access to web browsing mode
12. Added Ctrl+Shift+V shortcut for pasting plain text
13. Improved backup import to retain existing data that is not included in the backup file
14. Added individual artifact preview support for each HTML code block
15. Fixed SVG display issues in certain scenarios
16. Fixed LaTeX rendering issues and improved compatibility
17. Fixed occasional web search failure with Gemini
18. Optimized Gemini system prompts for better performance
19. Fixed various minor issues

### v1.8.1 - 2024.12.23

1. Fixed an issue with DALL-E API requests.

### v1.8.0 - 2024.12.22

1. Introduced Web Browsing capability. Chatbox AI Models and Gemini 2.0 flash(API) can now be enabled to access real-time internet information, providing responses with cited sources
2. Added first-token latency display for message generation, toggleable in settings
3. Enhanced image preprocessing capabilities. You can now send images in more formats (e.g., svg, gif) - Chatbox automatically converts them to model-compatible formats and adjusts dimensions to meet model requirements
4. Double-click thread title to quickly access the thread list
5. Improved compatibility for custom model provider configurations - Chatbox now automatically corrects and handles common configuration errors
6. Increased maximum temperature range to 2.0
7. Added confirmation for all delete actions 
8. Updated model list, removing deprecated models
9. Various minor bug fixes and improvements

### v1.7.0 - 2024.12.01

1. Added message branching feature. When regenerating a message, a new branch will be created, allowing you to switch between branches. If you prefer the original behavior, you can choose to expand all branched messages from the branch menu.
2. Automatically remembers code block collapse state
3. Improved Markdown and code block rendering performance
4. Added ability to save a thread as a new conversation
5. Multiple file selection now supported when inserting files or images
6. On Windows, an exit fullscreen button appears when hovering over the title bar in fullscreen mode
7. Added Norwegian and Swedish language support
8. Fixed various other issues

### v1.6.1 - 2024.11.12

1. Added context length and temperature controls in custom provider conversation settings.
2. Adjusted the maximum height of the input box. The input area now automatically expands when handling larger amounts of text.
3. Added a copy button for Mermaid code blocks.
4. Fixed text display issues when rendering complex Mermaid flowcharts.
5. Fixed an issue where only images were being inserted when copying content from doc/ppt/xlsx/pdf files.
6. Fixed an issue where the floating collapse button below code blocks was overlapping with the horizontal scrollbar.

### v1.6.0 - 2024.11.03

1. Now you can send web links. Chatbox will automatically fetch webpage content and include it in the chat context. Works with all models.
2. Now you can send text files to any models. Chatbox will parse file content locally and include it in the chat context.
3. Added collapsible code blocks. Long code blocks in chat history are automatically collapsed (can be disabled in settings).
4. Redesigned image preview window.
5. Redesigned SVG image preview and save functionality.
6. Redesigned Mermaid diagram preview and save functionality.
7. Improved auto-scroll behavior: auto-scroll stops when generated message fills the screen for better readability.
8. Optimized overall app layout and spacing.
9. Auto-fetch model options from remote
10. Support sending attachments (images/links/files) without text
11. Fixed language preference issues in auto-generated titles.
12. Fixed data issues when editing messages in copied conversations.
13. Fixed drawer direction issues in Arabic.

### v1.5.1 - 2024.10.09

1. Fixed an issue on Windows where multiple application instances could be launched, causing duplicate icons in the system tray
2. On macOS, System Events permission is now only requested when enabling the "launch at startup" option, rather than automatically requesting it when the application starts
3. Fixed an issue where automatically generated titles were occasionally truncated

### v1.5.0 - 2024.10.05

1. Added system tray icon, optimized show/hide shortcut
2. Input box now supports direct drag-and-drop insertion of images or files
3. Added option for launch at system startup (disabled by default, can be enabled in settings)
4. Added thread title menu for quick thread switching and deletion
5. Added toggle for automatic title generation to save tokens when disabled
6. Added Italian language support
7. Gemini and Groq models now support fetching the latest model lists remotely
8. Gemini models now support sending images by default
9. Ollama models now support sending images by default
10. Updated model lists for various model providers
11. Improved mobile experience, fixed issue with excessive bottom space after keyboard pop-up

### v1.4.2 - 2024.09.13

1. Added support for OpenAI's new o1 model series
2. SVG image previews are now available
3. Fixed display bugs with Artifact previews
4. Fixed various minor bugs

### v1.4.1 - 2024.09.04

1. Chatbox AI service users can now choose from a wider range of models
2. Added Arabic language support (العربية)
3. Improved LaTeX styling
4. Fixed a rare issue that could cause data loss
5. Various minor bug fixes and improvements

### v1.4.0 - 2024.08.18

1. Added Mermaid chart preview, now you can preview AI-generated charts, flowcharts, mind maps, etc.
2. Added quick buttons to switch between models
3. Now you can add model options for custom models
4. Updated model lists for various providers
5. Added support for sending images when connecting to ollama's llava model
6. After changing avatars, you can now revert to the default avatar
7. Added support for Spanish and Portuguese languages
8. Fixed several known minor issues

### v1.3.16 - 2024.07.22

1. Add support for new model gpt-4o-mini API

### v1.3.15 - 2024-07-17

1. Introduced **Artifact Preview** feature: Now you can preview HTML code (including JS, CSS, and TailwindCSS) within generated messages.
2. Added pop-up mode for Artifact Preview.
3. New toggle in Settings to enable automatic Artifact rendering.
4. Enhanced chat UI for a more visually appealing experience.
5. Optimized message generation performance.
6. Resolved known issues with app update notifications.
7. Resolved connection issues with Ollama on the Android version.
8. Enhanced compatibility with older Android OS versions.
9. Fixed several known bugs.

### v1.3.14 - 2024.06.30

1. Added support for setting user and assistant avatars.
2. Fixed some API compatibility issues with custom model providers.
3. Resolved various known bugs.

### v1.3.13 - 2024.06.23

1. Add support for new model Claude 3.5 sonnet
2. Fixed some known issues

### v1.3.12 - 2024.06.11

1. Added support for an unlimited number of custom model providers, allowing for easy integration and switching between various API-compatible models.
2. Enhanced the keyboard experience on mobile devices.
3. Fixed several minor known issues.

### v1.3.11 - 2024.05.26

1. Chatbox AI 3.5 now supports sending images.
2. Enhanced the interaction experience of the partner list.
3. Improved code block color scheme in night mode.

### v1.3.10 - 2024.05.15

1. Added support for the new Gemini-1.5-Flash model 
2. You can now send images to the Gemini model series

### v1.3.9 - 2024.05.14

1. Added support for the new GPT-4o model.
2. Refined the UI for global message search.
3. Image detail dialog now supports image zoom.
4. Enhanced various other UI details.

### v1.3.6 - 2024.05.04

**New Features:**
- Enhanced conversation-specific settings with an easy-to-use interface for modifying system prompts.
- Added the ability to export chat logs from conversations in various formats including HTML, TXT, and MD.
- Introduced image sending capabilities for Custom Models.
- Integrated support for Groq.

**Improvements:**
- Implemented automatic collapsing of lengthy system prompts with an option for manual expansion.
- Reworked conversation-specific settings with a new button to revert to global defaults.
- Adjusted the maximum width of message bodies for an improved reading experience, with a toggle button for width adjustments.
- Optimized the display performance of floating menus and button groups.

**Fixes:**
- Fixed an issue where spaces could not be entered when creating a copilot.
- Resolved System Prompt issues with the GPT-4-Turbo model.
- Addressed display issues for messages with very low height.

**Miscellaneous:**
- After switching between historical topics, the message list now automatically scrolls to the bottom.
- Enabled access to local Ollama services within the Chatbox web version.


### v1.3.5

1. Fixed a bug where text copied from Microsoft Word was inserted as an image.

### v1.3.4

1. You can now send files to AI, with support for PDF, DOC, PPT, XLS, TXT, and code files.
2. The input box now allows you to insert images and files from the system clipboard.
3. Added support for auto-generating thread titles.
4. Now supporting the latest gpt-4-turbo model.
5. You can change the installation path during setup in Windows.
6. Your can switch Gemini model version, with support for the new Gemini 1.5 pro model.
7. Fixed an issue with an abnormal message sequence in Claude causing API errors.
8. Made some UI detail adjustments.

### 1.3.3

1. You can now set user avatars in messages.
2. Added support for configuring a custom API host for Gemini.
3. Implemented an option in settings to enable or disable Markdown and LaTeX rendering.
4. Fixed issues with LaTeX rendering.
5. Fixed potential stuttering and crashing issues during message generation.
6. Fixed issues with redundant pop-up prompts during auto-updating.
7. Fixed various minor bugs.

### v1.3.1

1. Introduced support for the claude-3-sonnet-20240229 model.
2. Fixed a bug that caused blank text blocks to appear in claude model requests.
3. Fixed the auto-scroll bug in the message list that occurred when editing past messages.

### v1.3.0

1. Introducing Vision feature: You can now send images to AI!
2. Support for the latest Claude 3 series models.
3. A complete redesign of the app layout for a fresh and intuitive user experience.
4. Added message timestamps
5. Fixed some known minor issues

### v1.2.6

1. Added new model series for version 0125 (gpt-3.5-turbo-0125, gpt-4-0125-preview, gpt-4-turbo-preview).
2. Optimized mobile adaptation for some dialogs.

### v1.2.4

1. You can now use the ⬆️⬇️ arrow keys in the input field to select and quickly enter previous messages.
2. Fixed the spell check feature, which can now be turned off in settings.
3. Text copied from Chatbox will be copied to the clipboard as plain text without background color — a longstanding minor bug that has finally been resolved.

### v1.2.2

1. **Thread Archiving** (refreshes context) and Thread History List.
2. Introduced support for the **Google Gemini** model.
3. Introduced support for the **Ollama**, enabling easy access to locally deployed models such as llama2, mistral, mixtral, codellama, vicuna, yi, and solar.
4. Fixed an issue where the fullscreen window would not restore to fullscreen on the second launch.

### v1.2.1

1. Redesigned the message editing dialog
2. Fixed an issue where token configurations could not be saved
3. Fixed the positioning issue with newly copied conversations
4. Simplified the tips in settings
5. Optimized some interaction issues
6. Fixed several other issues

### v1.2.0

- Added an image generation feature (Image Creator); you can now generate images within Chatbox, powered by the Dall-E-3 model.
- Improved some usability issues.

### v1.1.4

- Added direct support for the gpt-3.5-turbo-1106 and gpt-4-1106-preview models.
- Updated the method for calculating message tokens to be more accurate.
- Introduced the Top P parameter option.
- The temperature parameter now supports two decimal places.
- The software now retains the last conversation upon startup.

### v1.1.2

- Optimized the interaction experience of the search box
- Fixed the scrolling issue with new messages
- Fixed some network related issues

### v1.1.1

- Fixed an issue where message content cannot be selected during generation process
- Improved the performance of the search function, making it faster and more accurate
- Adjusted the layout style of messages
- Fixed some other minor issues

### v1.1.0

- Now you can search messages from current chat or all chats
- Data backup and restore (data import/export)
- Fixed some minor issues

### v1.0.4

- Keep the previous window size and position upon startup (#30)
- Hide the system menu bar (for Windows, Linux)
- Fixed an issue with session-specific settings causing license and other settings abnormalities (#31)
- Adjusted some UI details

### v1.0.2

- Automatically move cursor to the bottom of the input box when quoting a message.
- Fixed the issue of resetting context length setting when switching models (#956).
- Automatically compatible with various Azure Endpoint configurations (#952).

### v1.0.0

- Support OpenAI custom models (#28)
- The up arrow key can quickly input the previously sent message.
- Added x64 and arm64 architecture versions to Windows and Linux installation packages.
- Fixed issue in session settings of Azure OpenAI where the model deployment name could not be modified (#927).
- Fixed issue with inability to enter spaces and line breaks when modifying default prompt (#942).
- Fixed scrolling issue after editing long messages.
- Fixed various other minor issues.

### v0.6.7

- Action buttons on messages now remain visible during list scrolling
- Added support for the Claude series models (beta)
- Language support expanded to include more countries
- Fixed some minor issues

### v0.6.5

- Added application shortcuts for quickly showing/hiding windows, switching conversations, etc. See the settings page for details.
- Introduced a new setting for the maximum amount of context messages, allowing more flexible control of the context message count and saving token usage.
- Added support for OpenAI 0301 and 0314 model series.
- Added a temperature setting in the conversation special settings.
- Fixed some minor issues.

### v0.6.3

- Added support for modifying model settings for each conversation (this allows different sessions to use different models)
- Optimized performance when handling large amounts of data
- Made the UI more compact
- Fixed several minor issues

### v0.6.2

- Added bulk cleaning feature for conversation lists
- Support for displaying token usage of messages
- Support for modifying the default prompt for new conversations
- Support for setting smaller font sizes
- Fixed a few other minor issues

### v0.6.1

- Improved software stability and performance
- More user-friendly error messages
- Use system language during initialization
- Fixed occasional installation errors and white screen issues on Windows
- Fixed compatibility issues related to configuration saving on MacOS 10
- Fixed performance issues on Linux
- Fixed network issues with API Host when using the HTTP protocol

### v0.5.6

- Improved window selection strategy for message contexts
- Enhanced settings for message context and generated message max tokens
- Fixed some minor issues

### v0.5.2

- Fix settings saving issue on Windows 11
- Optimize loading animation for message generation
- Resolve some other issues

### v0.5.1

- Fixed the issue of saving settings in Windows 11

### v0.5.0

- Built-in AI service "Chatbox AI" - ready to use out of the box with fast, hassle-free setup.
- Fixed the issue where the night theme would not work after restarting
- Fix the issue of being unable to switch sessions while generating answers
- Fixed lag issues when editing messages
- Fixed issues with conversation name changes and cleared messages reappearing after clearing messages
- Fixed several other minor issues

### 0.4.5

- Added "My Copilots" feature 🚀🚀🚀
- A large number of AI copilots are ready to work with you
- You can also create your own AI copilot through prompts
- Added support for ChatGLM-6B
- Fixed some known minor issues

### v0.4.4

- Added support for Microsoft Azure OpenAI API
- Fixed some minor known issues

`

export default changelog
