import { ContinuousScale } from './continuousScale';
import ticks, { tickStep } from '../util/ticks';
import { tickFormat } from '../util/numberFormat';

/**
 * Maps continuous domain to a continuous range.
 */
export class LinearScale extends ContinuousScale {
    readonly type = 'linear';

    ticks() {
        if (!this.domain || this.domain.length < 2) {
            return [];
        }
        this.refresh();
        const [d0, d1] = this.getDomain();
        const count = this.tickCount ?? 10;

        return ticks(d0, d1, count);
    }

    update() {
        if (!this.domain || this.domain.length < 2) {
            return;
        }
        if (this.nice) {
            this.updateNiceDomain();
        }
    }

    /**
     * Extends the domain so that it starts and ends on nice round values.
     * @param count Tick count.
     */
    protected updateNiceDomain() {
        const count = this.tickCount ?? 10;
        let [start, stop] = this.domain;

        for (let i = 0; i < 2; i++) {
            const step = tickStep(start, stop, count);
            if (step >= 1) {
                start = Math.floor(start / step) * step;
                stop = Math.ceil(stop / step) * step;
            } else {
                // Prevent floating point error
                const s = 1 / step;
                start = Math.floor(start * s) / s;
                stop = Math.ceil(stop * s) / s;
            }
        }
        this.niceDomain = [start, stop];
    }

    tickFormat({ count, specifier }: { count?: number; ticks?: any[]; specifier?: string }) {
        const [d0, d1] = this.getDomain();
        return tickFormat(d0, d1, count ?? 10, specifier);
    }
}
