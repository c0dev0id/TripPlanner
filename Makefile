# Portable make (OpenBSD make and GNU make): no conditionals, no shell functions.

COMPOSER ?= composer
NPM ?= npm
PHP ?= php-8.4

# Builds the application for deployment: PHP dependencies without development packages
# and the frontend bundle in public/build. Run after git pull on the server.
build:
	$(COMPOSER) install --no-dev --no-interaction --optimize-autoloader
	$(NPM) ci
	$(NPM) run build

# Installs everything needed for development and testing.
install:
	$(COMPOSER) install --no-interaction
	$(NPM) ci

init:
	doas -u www php-8.4 bin/planner db:init
# A fresh start while nothing is released: drops every table, applies the schema again
# and removes the journal's files. Every account, trip and file is lost.
recreate:
	doas -u www php-8.4 bin/planner db:recreate
invite:
	doas -u www php-8.4 bin/planner invite $(EMAIL)
admin:
	doas -u www php-8.4 bin/planner admin:grant $(EMAIL)
# Fetches Garmin's pictures of its waypoint symbols into public/garmin-symbols, which git
# leaves alone: they are Garmin's artwork. Pictures already there are kept.
garmin-icons:
	$(PHP) bin/planner garmin:icons

# Runs what CI runs: syntax checks, PHP tests, type check, frontend tests and the build.
check:
	$(COMPOSER) validate
	$(COMPOSER) lint
	$(COMPOSER) test
	$(NPM) run typecheck
	$(NPM) test
	$(NPM) run build

.PHONY: build install init recreate invite admin garmin-icons check
