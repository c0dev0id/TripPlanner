# Portable make (OpenBSD make and GNU make): no conditionals, no shell functions.

COMPOSER ?= composer
NPM ?= npm
PHP ?= php-8.5
EMAIL ?= sh@codevoid.de
PASS != pass Internet/planner.codevoid.de | head -1

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
	doas -u www $(PHP) bin/planner db:init

# A fresh start while nothing is released: drops every table, applies the schema again
# and removes the journal's files. Every account, trip and file is lost.
recreate:
	doas -u www $(PHP) bin/planner db:recreate
	make user
	make admin
	make password

invite:
	doas -u www $(PHP) bin/planner invite $(EMAIL)

# Makes an account without an invitation and prints its generated password, which has to
# be replaced at the first sign-in.
user:
	doas -u www $(PHP) bin/planner user:create $(EMAIL)

# Sets a new password on an existing account; the user keeps using the application without
# being asked to change it.
password:
	@doas -u www $(PHP) bin/planner user:password $(EMAIL) $(PASS)

admin:
	doas -u www $(PHP) bin/planner admin:grant $(EMAIL)

# Fetches Garmin's pictures of its waypoint symbols into public/garmin-symbols, which git
# leaves alone: they are Garmin's artwork. Pictures already there are kept.
garmin-icons:
	$(PHP) bin/planner garmin:icons

# Fetches the roads closed to motorcycles from mintelonline.de into public/closures.geojson,
# which git leaves alone: the map's closures overlay. The source changes every few weeks;
# run it from cron.
closures:
	$(PHP) bin/planner closures:fetch

# Fetches the places of an area (fuel stations, hotels and the like) from OpenStreetMap into
# the planner's store, in place of what was kept for the area: make places AREA=DE-RP.
# AREA is the ISO 3166-2 code of a region, or the ISO 3166-1 code of a whole country;
# without AREA, the areas to pick from are listed, with what is kept of each. Run it from
# cron, an area at a time and far apart; the planner asks only its store.
places:
	doas -u www $(PHP) bin/planner places:fetch $(AREA)

# Runs what CI runs: syntax checks, PHP tests, type check, frontend tests and the build.
check:
	$(COMPOSER) validate
	$(COMPOSER) lint
	$(COMPOSER) test
	$(NPM) run typecheck
	$(NPM) test
	$(NPM) run build

.PHONY: build install init recreate invite user password admin garmin-icons closures places check
