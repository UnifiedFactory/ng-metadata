import { Component, Inject, Input, OnDestroy } from 'ng-metadata/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, take, takeUntil } from 'rxjs/operators';

interface State {
  data: number;
}

@Component({
  selector: 'async-destroy-child',
  template: `
    State is {{ ($ctrl.state$ | async:this).data }}
  `
})
export class AsyncDestroyChildComponent implements OnDestroy {
  @Input('<') state$: BehaviorSubject<State>;

  private destroy = false;

  constructor(@Inject('$scope') private $scope: ng.IScope) {
    this.$scope.$watch(
      () => {
        // watch digest loops
        if (this.destroy) {
          alert('Memory leak');
        }
        return true;
      },
      () => {}
    );
  }

  ngOnDestroy() {
    this.destroy = true;
  }
}

@Component({
  selector: 'async-destroy-container',
  template: `
    <async-destroy-child state$="$ctrl.state$"></async-destroy-child>
  `
})
export class AsyncDestroyContainerComponent implements OnDestroy {
  @Input('<') state$: BehaviorSubject<State>;

  constructor() {}

  ngOnDestroy() {
    // to start synchronous effects while destroy phase
    this.state$.next({ data: 1 });
  }
}

@Component({
  selector: 'async-destroy',
  template: `
    <hl>
      <h4>Check for Memory leak</h4>
      <button ng-click="$ctrl.toggle()">Start</button>
      <div ng-if="$ctrl.showChild$ | async:this">
        <async-destroy-container state$="$ctrl.state$"></async-destroy-container></div
    ></hl>
  `
})
export class AsyncDestroyComponent implements OnDestroy {
  state$ = new BehaviorSubject<State>({
    data: 1
  });

  // observable to create/destroy underlying component
  showChild$ = this.state$.pipe(
    map((state: State) => state.data % 2),
    distinctUntilChanged()
  );

  private ngOnDestroy$ = new Subject<void>();

  constructor(@Inject('$interval') private $interval: ng.IIntervalService) {
    this.runEffects();
  }

  ngOnDestroy() {
    this.ngOnDestroy$.next();
    this.ngOnDestroy$.complete();
  }

  toggle() {
    this.state$.pipe(take(1)).subscribe((state: State) => {
      this.state$.next({ ...state, data: state.data + 1 });
    });
  }

  private runEffects() {
    // simulate some synchronous effects
    this.state$.pipe(takeUntil(this.ngOnDestroy$)).subscribe((state: State) => {
      if (state.data % 3) {
        // to prevent infinite loop
        this.state$.next({ ...state, data: state.data + 1 });
      }
    });
  }
}
