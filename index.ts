import cmd from "./command"

if (require.main === module) cmd.execute(...process.argv);
