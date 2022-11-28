import * as os from 'os';
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Architecture, AssetCode, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import { BundlingOptions } from "./types";
import { exec, getDotNetLambdaTools } from './util';

export interface BundlingProps extends BundlingOptions {
  /**
   * Directory containing your go.mod file
   *
   * This will accept either a directory path containing a `go.mod` file
   * or a filepath to your `go.mod` file (i.e. `path/to/go.mod`).
   *
   * This will be used as the source of the volume mounted in the Docker
   * container and will be the directory where it will run `go build` from.
   *
   * @default - the path is found by walking up parent directories searching for
   *  a `go.mod` file from the location of `entry`
   */
  readonly projectDir: string;

  /**
   * The runtime of the lambda function
   */
  readonly runtime: Runtime;

  /**
   * The system architecture of the lambda function
   */
  readonly architecture: Architecture;
}

export class Bundling implements cdk.BundlingOptions {
  private static runsLocally?: boolean;

  public readonly image: cdk.DockerImage;
  public readonly command: string[];
  public readonly environment?: { [key: string]: string };
  public readonly local?: cdk.ILocalBundling;

  private readonly relativeProjectPath: string;

  public static bundle(options: BundlingProps): AssetCode {
    const bundling = new Bundling(options);

    return Code.fromAsset(path.dirname(options.projectDir), {
      assetHashType: options.assetHashType ?? cdk.AssetHashType.OUTPUT,
      assetHash: options.assetHash,
      bundling: {
        image: bundling.image,
        command: bundling.command,
        environment: bundling.environment,
        local: bundling.local,
      },
    });
  }

  constructor(private readonly props: BundlingProps) {
    Bundling.runsLocally = Bundling.runsLocally ?? getDotNetLambdaTools() ?? false;

    const projectRoot = props.projectDir;
    this.relativeProjectPath = `./${props.projectDir}`;

    const environment = {
      ...props.environment,
    };

    // Docker Bundling
    const shouldBuildImage = props.forcedDockerBundling || !Bundling.runsLocally;
    this.image = shouldBuildImage
      ? props.dockerImage ??
        cdk.DockerImage.fromBuild(path.join(__dirname, "./"), {
          buildArgs: {
            ...(props.buildArgs ?? {}),
            IMAGE: Runtime.DOTNET_6.bundlingImage.image, // always use the DOTNET_6 build image
          },
          platform: props.architecture.dockerPlatform,
        })
      : cdk.DockerImage.fromRegistry("dummy"); // Do not build if we don't need to
  
    const bundlingCommand = this.createBundlingCommand(cdk.AssetStaging.BUNDLING_INPUT_DIR, cdk.AssetStaging.BUNDLING_OUTPUT_DIR);
      this.command = ['bash', '-c', bundlingCommand];
      this.environment = environment;
    
    // Local bundling
    if (!props.forcedDockerBundling) { // only if Docker is not forced
      const osPlatform = os.platform();
      const createLocalCommand = (outputDir: string) => this.createBundlingCommand(projectRoot, outputDir, osPlatform);
      this.local = {
        tryBundle(outputDir: string) {
          if (Bundling.runsLocally == false) {
            process.stderr.write('go build cannot run locally. Switching to Docker bundling.\n');
            return false;
          }
          const localCommand = createLocalCommand(outputDir);
          exec(
            osPlatform === 'win32' ? 'cmd' : 'bash',
            [
              osPlatform === 'win32' ? '/c' : '-c',
              localCommand,
            ],
            {
              env: { ...process.env, ...environment ?? {} },
              stdio: [ // show output
                'ignore', // ignore stdio
                process.stderr, // redirect stdout to stderr
                'inherit', // inherit stderr
              ],
              cwd: props.projectDir,
              windowsVerbatimArguments: osPlatform === 'win32',
            },
          );
          return true;
        }
      }
    }
  }

  public createBundlingCommand(inputDir: string, outputDir: string, osPlatform: NodeJS.Platform = 'linux'): string {
    const pathJoin = osPathJoin(osPlatform);

    const packageFile = pathJoin(outputDir, 'package.zip');
    const dotnetPackageCommand: string = ['dotnet', 'lambda', 'package', '--output-package', packageFile].filter(c => !!c).join(' ');
    const unzipCommand: string = ['unzip', '-od', outputDir, packageFile].filter(c => !!c).join(' ');
    const deleteCommand: string = ['rm', packageFile].filter(c => !!c).join(' ');

    console.log(dotnetPackageCommand);

    return chain([
      ...this.props.commandHooks?.beforeBundling(inputDir, outputDir) ?? [],
      dotnetPackageCommand,
      unzipCommand,
      deleteCommand,
      ...this.props.commandHooks?.afterBundling(inputDir, outputDir) ?? [],
    ]);
  }
}

/**
 * Platform specific path join
 */
 function osPathJoin(platform: NodeJS.Platform) {
  return function(...paths: string[]): string {
    const joined = path.join(...paths);
    // If we are on win32 but need posix style paths
    if (os.platform() === 'win32' && platform !== 'win32') {
      return joined.replace(/\\/g, '/');
    }
    return joined;
  };
}

function chain(commands: string[]): string {
  return commands.filter(c => !!c).join(' && ');
}
