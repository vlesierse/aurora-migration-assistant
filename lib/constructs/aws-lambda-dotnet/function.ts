import * as fs from 'fs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Bundling } from './bundling';
import { BundlingOptions } from './types';

export interface DotNetFunctionProps extends lambda.FunctionOptions {
  /**
   * The runtime environment. Only runtimes of the .NET family and provided family are supported.
   *
   * @default lambda.Runtime.DOTNET_6
   */
   readonly runtime?: lambda.Runtime;

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
   * The name of the method within your code that Lambda calls to execute your function.
   * The format includes the file name. It can also include namespaces and other qualifiers,
   * depending on the runtime. For more information,
   * see https://docs.aws.amazon.com/lambda/latest/dg/foundation-progmodel.html.
   * @default - the .csproj file is used as project name and the handler is
   * composed as ${projectName}::${projectName}.Function::FunctionHandler
   */
  readonly handler?: string;

   /**
   * Bundling options
   *
   * @default - use default bundling options
   */
  readonly bundling?: BundlingOptions;
}

export class DotNetFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: DotNetFunctionProps) {
    if (props.runtime && (props.runtime.family !== lambda.RuntimeFamily.DOTNET_CORE && props.runtime.family != lambda.RuntimeFamily.OTHER)) {
      throw new Error('Only `.NET` and `provided` runtimes are supported.');
    }
    const { projectDir } = props;
    const runtime = props.runtime ?? lambda.Runtime.DOTNET_6;
    const architecture = props.architecture ?? lambda.Architecture.X86_64;
    let handler: string;
    if (props.handler) {
      handler = props.handler;
    } else {
      const projectFile = fs.readdirSync(projectDir).find((file) => file.endsWith('.csproj'));
      if (!projectFile) {
        throw new Error(`.csproj file at ${props.projectDir} doesn't exist`);
      }
      const projectName = projectFile.replace('.csproj', '');
      handler = `${projectName}::${projectName}.Function::FunctionHandler`;
    }

    super(scope, id, {
      ...props,
      runtime,
      code: Bundling.bundle({
        ...props.bundling ?? {},
        runtime,
        architecture,
        projectDir,
      }),
      handler
    });
  }
}