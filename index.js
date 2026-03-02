//Import some assets from Vortex we'll need.
const path = require('path');
const { fs, log, util } = require('vortex-api');

// Nexus Mods domain for the game. "nexusmods.com/games/*gamename*"
const GAME_ID = 'superworldbox';

//Steam Application ID, you can get this from https://steamdb.info/apps/
const STEAMAPP_ID = '1206560';

// NML primary dll, we use this to make sure NML is installed and mods will compile.
const NML_DLL = 'Assembly-CSharp-Publicized.dll';

// NML mod page, we link to this if the user doesn't have NML installed.
const NML_MODPAGE = 'https://github.com/WorldBoxOpenMods/ModLoader/releases'

//Mod file extension, we use this to verify an archive is a valid mod package and prevent invalid mods from installing.
const MOD_FILE_EXT = ".json";

function main(context) {
	//This is the main function Vortex will run when detecting the game extension. 
	context.registerGame({
    id: GAME_ID,
    name: 'Worldbox: God Simulator',
    mergeMods: false,
    queryPath: findGame,
    supportedTools: [],
    queryModPath: () => 'Mods',
    logo: 'gameart.png',
    executable: () => 'worldbox.exe',
    requiredFiles: [
      'worldbox.exe',
      'worldbox_Data/app.info',
    ],
    setup: (discovery) => prepareForModding(discovery, context.api),
    environment: {
      SteamAPPId: STEAMAPP_ID,
    },
    details: {
      steamAppId: STEAMAPP_ID,
    },
  });
  
  context.registerInstaller('worldbox-mod', 25, (files, gameId) => testSupportedContent(files, gameId, context.api), installContent);

	return true;
}

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAMAPP_ID])
      .then(game => game.gamePath);
}

function prepareForModding(discovery, api) {
    const NMLpath = path.join(discovery.path, 'worldbox_Data', 'StreamingAssets', 'mods', 'NML', NML_DLL);
   
    return fs.ensureDirWritableAsync(path.join(discovery.path, 'Mods'))
        .then(() => checkForNML(api, NMLpath));
}

function checkForNML(api, NMLpath) {
  return fs.statAsync(NMLpath)
    .catch(() => {
      api.sendNotification({
        id: 'nml-missing',
        type: 'warning',
        title: 'NML not installed',
        message: 'NML is required to mod Worldbox: God Simulator.',
        actions: [
          {
            title: 'Get NML',
            action: () => util.opn(NML_MODPAGE).catch(() => undefined),
          },
        ],
      });
    });
}

function testSupportedContent(files, gameId, api) {
  // Make sure we're able to support this mod.
  const hasJsonFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined;

  // Define the conditions for support. The gameId must match and there must be a .json file in the archive.
  let supported = (gameId === GAME_ID) && hasJsonFile;

  // If the gameid doesn't match or a json file is not found we determine the package is invalid. Send an error to the user through the api pipeline.
  if (!supported) {
    api.sendNotification({
      id: 'worldbox-install-failed',
      type: 'error',
      title: 'Installation Failed',
      message: `No ${MOD_FILE_EXT} file found. The archive does not appear to be a valid Worldbox mod package.`,
    });

  // Then reject the promise to block the installation.
    return Promise.reject(new Error(`Invalid mod: no ${MOD_FILE_EXT} file found in archive.`));
  }

  // Otherwise, resolve the promise and proceed to installation.
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installContent(files) {
  // The .json file is expected to always be positioned in the mods directory, we're going to disregard anything placed outside the root.
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);
  
  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file => 
    ((file.indexOf(rootPath) !== -1) 
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

module.exports = {
    default: main,
};
