import { Client } from "ssh2";
import yoctoSpinner from "yocto-spinner";
import { server } from "../utils/types";

// this function creates a raw input ssh connection

function sshConnection(
  sshConfig: server,
  unref: boolean = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const spinner = yoctoSpinner({ text: "Connecting to server…" }).start();
    const client = new Client();

    client
      .on("close", () => {
        console.log("Connection closed ⚪");
        resolve(); // resolve the promise when the connection closes
      })
      .on("error", (err) => {
        spinner.error("Connection error! ⛔");
        console.log("Error details", err.message);
      })
      .on("ready", function () {
        spinner.success("Connection ready! 🟢");
        this.shell(
          {
            term: process.env.TERM,
            rows: process.stdout.rows,
            cols: process.stdout.columns,
          },
          (err, stream) => {
            if (err) {
              reject(err); // reject the promise if shell creation fails
              return;
            }

            stream.on("close", () => {
              if (unref) {
                process.stdin.unref(); // unless it is specified for a certain usecase, this line will terminate the whole application
              }
              this.end(); // close the connection
            });

            process.stdin.setRawMode(true);
            process.stdin.pipe(stream);
            stream.pipe(process.stdout);

            process.stdout.on("resize", () => {
              stream.setWindow(
                process.stdout.rows,
                process.stdout.columns,
                0,
                0
              );
            });
          }
        );
      })
      .connect(sshConfig);
  });
}

export default sshConnection;
