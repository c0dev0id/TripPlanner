# Portable make (OpenBSD make and GNU make): no conditionals, no shell functions.

COMPOSER ?= composer
NPM ?= npm

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
invite:
	doas -u www php-8.4 bin/planner invite $(EMAIL)
admin:
	doas -u www php-8.4 bin/planner admin:grant $(EMAIL)

# Runs what CI runs: syntax checks, PHP tests, type check, frontend tests and the build.
check:
	$(COMPOSER) validate
	$(COMPOSER) lint
	$(COMPOSER) test
	$(NPM) run typecheck
	$(NPM) test
	$(NPM) run build

.PHONY: build install check
