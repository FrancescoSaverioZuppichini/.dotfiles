# Rainbow CSV for Visual Studio Code Change Log

## 1.8.1
* Minor RBQL update

## 1.8.0
* New command: "SetHeaderLine" by @WetDesertRock, see [#71](https://github.com/mechatroner/vscode_rainbow_csv/issues/71)
* Updated RBQL
* Added integration tests


## 1.7.0
* Updated RBQL
* Improved RBQL UI


## 1.6.0
* Updated RBQL


## 1.5.0
* Highlight column info tooltip with the same color as the column itself


## 1.4.0
* Run CSV autodetection whenever a text chunk is copied into a new untitled buffer
* Improve startup performance
* RBQL: Support column names as variables
* RBQL: Support newlines in double-quoted CSV fields
* RBQL: Change default encoding to UTF-8
* RBQL: Enable for untitled buffers
* RBQL: Improve UI/UX, add history, built-in docs


## 1.3.0
* Updated RBQL to version 0.9.0
* Restricted usage of Align/Shrink commands in files with unbalanced double quotes
* Fixed incorrect dialect name: "tilda" -> "tilde", see [#40](https://github.com/mechatroner/vscode_rainbow_csv/issues/40)
* Added an eror message when RBQL console is used with unsaved file [#41](https://github.com/mechatroner/vscode_rainbow_csv/issues/41)


## 1.2.0
* Added frequency-based fallback content-based autodetection algorithm for .csv files
* Adjusted default parameters: added '|' to the list of autodetected separators
* Fixed "Align/Shrink" button logic [#38](https://github.com/mechatroner/vscode_rainbow_csv/issues/38)
* Fixed bug: incorrect RBQL result set dialect when output dialect doesn't match input
* Improved documentation


## 1.1.0
* Special treatment of comment lines by [@larsonmars](https://github.com/larsonmars)
* RBQL encoding customization by [@mandel59](https://github.com/mandel59)
* Implemented Whitespace-separated dialect
* Linter: detect trailing whitespaces in fields [#15](https://github.com/mechatroner/vscode_rainbow_csv/issues/15)
* Added commands: remove trailing whitespaces from all fields and allign columns with trailing whitespaces
* Implemented RBQL result set copy-back command
* Improved RBQL console UI
* Customizable "Preview big CSV: head/tail" context menu options [#32](https://github.com/mechatroner/vscode_rainbow_csv/issues/32)
* Improved autodetection algorithm for files with multiple candidate separators


## 0.8.0
* Large files preview functionality implemented by [@neilsustc](https://github.com/neilsustc) see [#24](https://github.com/mechatroner/vscode_rainbow_csv/issues/24)  
* Fix single-autodetection per file limit, see [#26](https://github.com/mechatroner/vscode_rainbow_csv/issues/26)  
* Enable content-based autodetection for .csv files  
* Support tooltip message customizations, see [#12](https://github.com/mechatroner/vscode_rainbow_csv/issues/12)  
* Fix RBQL warnings  
* Various minor improvements  


## 0.7.1
* Fix: Added safety check to RBQL that would prevent accidental usage of assignment operator "=" instead of comparison "==" or "===" in JS (In Python this was not possible before the fix due to Python's own syntatic checker).  
* Added "Rainbow CSV" category to all extension commands by [@yozlet](https://github.com/yozlet) request, see [#22](https://github.com/mechatroner/vscode_rainbow_csv/issues/22)  
