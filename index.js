import inquirer from "inquirer";
import { attachFlavor } from "./src/controller/attachFlavor.js";
import detachFlavor from "./src/controller/detachFlavor.js";
import allocateBaremetal from "./src/controller/allocateBaremetal.js";
import  importBaremetal  from "./src/controller/importBaremetal.js";

async function main() {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "input",
        name: "action",
        message: `✔ Which task do you want to perform on portal?
1) Attach flavor
2) DeAttach flavor
3) Allocate Baremetal
4) Import Baremetal
5) Exit
Enter your choice (1/2/3/4/5):`,
        validate: function (input) {
          if (["1", "2", "3", "4", "5"].includes(input.trim())) {
            return true;
          }
          return "Please enter 1, 2, 3 , 4 or 5";
        },
      },
    ]);

    switch (action.trim()) {
      case "1":
        await attachFlavor();
        break;
      case "2":
        await detachFlavor();
        break;
      case "3":
        await allocateBaremetal();
        break;
      case "4":
        await importBaremetal();
        break;
      case "5":
        console.log("👋 Exiting the program.");
        process.exit(0);
      default:
        console.log("Invalid choice");
    }

    console.log("\n"); // Optional spacing between operations
  }
}

main(); 