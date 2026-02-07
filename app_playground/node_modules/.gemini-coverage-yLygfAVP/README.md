gemini-coverage
===============

Утилита для генерации HTML-отчета на основе JSON-отчета о покрытии тестами [gemini](http://github.com/gemini-testing/gemini).

Использование
-----

```
npm install gemini-coverage
./node_modules/.bin/gemini-coverage gen [путь к coverage.json]
```

По умолчанию файлы отчета будут сохранены в [текущая директори/gemini-coverage].

**Опции**

Чтобы создать отчет в папке `path/to/report`, а исходные файлы использовать из `path/to/source` выполните следующую команду:

```
./node_modules/.bin/gemini-coverage gen -r path/to/source -d path/to/report [путь к coverage.json]
```
