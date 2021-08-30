## Debugging in VSCode

### All unit tests except command line
Just use vscode default "run and debug" settings. From "run and debug' panel, select the "node.js" option, "Select Launch Configuration" command palette will appear, select one of the "Run Script: test:" options.

### Command line unit tests
Use the below VSCode launch configuration, modify args with the command line arguments you want to debug against.
```json
{
  "type": "pwa-node",
  "request": "launch",
  "name": "Launch Get-Set-Fetch Cli",
  "program": "${workspaceFolder}/dist/cjs/cli/cli.js",
  "args": [ "--version"],
  "skipFiles": [
    "<node_internals>/**"
  ],
  "preLaunchTask": "tsc: build - tsconfig.debug.json",
  "outFiles": [
    "${workspaceFolder}/dist/cjs/**/*.js"
  ]
}
```