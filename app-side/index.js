import { BaseSideService } from "@zeppos/zml/base-side";

AppSideService(
  BaseSideService({
    onInit() {
      this.log("side service onInit");
    },
    onRun() {
      this.log("side service onRun");
    },
    onDestroy() {
      this.log("side service onDestroy");
    },
  }),
);
