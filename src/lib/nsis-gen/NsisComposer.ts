
import { relative, resolve, win32 } from 'path';

import { readdirAsync, lstatAsync } from 'fs-extra-promise';

const globby = require('globby');

export interface INsisComposerOptions {

    // Basic.
    appName: string;
    companyName: string;
    description: string;
    version: string;
    copyright: string;

    // Compression.
    compression: 'zlib' | 'bzip2' | 'lzma';
    solid: boolean;

    // Files.
    srcDir?: string;

    // Output.
    output: string;

}

export class NsisComposer {

    public static DIVIDER = '################################################################################';

    protected fixedVersion: string;

    constructor(protected options: INsisComposerOptions) {

        if(!this.options.appName) {
            this.options.appName = 'NO_APPNAME';
        }

        if(!this.options.companyName) {
            this.options.companyName = 'NO_COMPANYNAME';
        }

        if(!this.options.description) {
            this.options.description = 'NO_DESCRIPTION';
        }

        if(!this.options.version) {
            this.options.version = 'NO_VERSION';
        }

        if(!this.options.copyright) {
            this.options.copyright = 'NO_COPYRIGHT';
        }

        this.options.compression = this.options.compression || 'lzma';
        this.options.solid = this.options.solid ? true : false;

        this.fixedVersion = this.fixVersion(this.options.version);

    }

    public async make(): Promise<string> {

        return `${ NsisComposer.DIVIDER }
#
# Generated by nsis-gen.
#
${ NsisComposer.DIVIDER }

${ await this.makeGeneralSection() }
${ await this.makeResourcesSection() }
${ await this.makeInstallSection() }
${ await this.makeUninstallSection() }
`;

    }

    protected async makeGeneralSection(): Promise<string> {

        return `${ NsisComposer.DIVIDER }
#
# General
#
${ NsisComposer.DIVIDER }

Name "${ this.options.appName }"
Caption "${ this.options.appName }"
BrandingText "${ this.options.appName }"
OutFile "${ win32.normalize(resolve(this.options.output)) }"
InstallDir "$PROGRAMFILES\\${ this.options.appName }"
SetCompressor ${ this.options.solid ? '/SOLID' : '' } ${ this.options.compression }
XPStyle on
`;

    }

    protected async makeResourcesSection(): Promise<string> {

        return `${ NsisComposer.DIVIDER }
#
# Resources
#
${ NsisComposer.DIVIDER }

VIProductVersion "${ this.fixedVersion }"
VIAddVersionKey "ProductName" "${ this.options.appName }"
VIAddVersionKey "CompanyName" "${ this.options.companyName }"
VIAddVersionKey "FileDescription" "${ this.options.description }"
VIAddVersionKey "FileVersion" "${ this.fixedVersion }"
VIAddVersionKey "LegalCopyright" "${ this.options.copyright }"
`;

    }

    protected async makeInstallSection(): Promise<string> {

        return `${ NsisComposer.DIVIDER }
#
# Main
#
${ NsisComposer.DIVIDER }

Section -Install

SetShellVarContext current
SetOverwrite ifnewer

${ await this.makeInstallerFiles() }

WriteUninstaller "$INSTDIR\\uninstall.exe"

SectionEnd
`;

    }

    protected async makeUninstallSection(): Promise<string> {

        return `${ NsisComposer.DIVIDER }
#
# Uninstall
#
${ NsisComposer.DIVIDER }

Section Uninstall

RMDir /r "$INSTDIR\\*.*"
RMDir "$INSTDIR"

SectionEnd
`;

    }

    protected async makeInstallerFiles(): Promise<string> {

        if(!this.options.srcDir) {
            throw new Error('ERROR_NO_SRCDIR');
        }

        const out: string[] = [];
        await this.readdirLines(resolve(this.options.srcDir), resolve(this.options.srcDir), out);

        return out.join('\n');

    }

    protected fixVersion(version: string) {
        // Fix "invalid VIProductVersion format, should be X.X.X.X" for semver.
        return /^\d+\.\d+\.\d+$/.test(this.options.version) ? `${ this.options.version }.0` : this.options.version;
    }

    protected async readdirLines(dir: string, baseDir: string, out: string[]) {

        const lines = [];
        const pendingFiles = [];

        const files = await readdirAsync(dir);

        if(files.length > 0) {
            const path = win32.normalize(relative(baseDir, dir));
            lines.push(`SetOutPath "$INSTDIR${ path == '.' ? '' : `\\${ path }` }"`);
        }

        for(const file of files) {

            const path = resolve(dir, file);
            const stat = await lstatAsync(path);

            if(stat.isFile()) {
                lines.push(`File "${ win32.normalize(path) }"`);
            }
            else if(stat.isDirectory()) {
                pendingFiles.push(path);
            }

        }

        for(const file of pendingFiles) {
            await this.readdirLines(resolve(dir, file), resolve(baseDir), lines);
        }

        out.push(...lines);

    }

}
