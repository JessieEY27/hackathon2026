const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Congratulations, your extension "code-explainer" is now active!');

	const disposable = vscode.commands.registerCommand('code-explainer.helloWorld', function () {
		vscode.window.showInformationMessage('Hello World from code-explainer!');
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
};