from typing import Any, Optional, Sequence, Union

from matplotlib.artist import Artist
from matplotlib.cbook import CallbackRegistry
from matplotlib.colors import _ColorLike
from matplotlib.figure import Figure
from matplotlib.text import Text
from matplotlib.ticker import Formatter, Locator
from matplotlib.transforms import Bbox


class Axes:
    # TODO: Most methods on Axes are the same as pyplot
    # (as pyplot is just global functions onto a shared Axes).
    # Mirror those here.

    isDefault_label: bool
    axes: Axes
    major: Ticker
    minor: Ticker
    callbacks: CallbackRegistry
    label: Text

    def __init__(
        self,
        fig: Figure,
        rect: Union[Bbox, Sequence[int]],
        facecolor: Optional[_ColorLike] = ...,
        frameon: bool = ...,
        sharex: Optional[Axes] = ...,
        sharey: Optional[Axes] = ...,
        label: str = ...,
        xscale: Optional[str] = ...,
        yscale: Optional[str] = ...,
        box_aspect: Optional[float] = ...,
        **kwargs: Any
    ) -> None: ...

    def __getattr__(self, name: str) -> Any: ...  # incomplete


class XAxis(Axes):
    def __getattr__(self, name: str) -> Any: ...  # incomplete

class YAxis(Axes):
    def __getattr__(self, name: str) -> Any: ...  # incomplete


class Ticker:
    locator: Locator
    formatter: Formatter

class Tick(Artist):
    def __getattr__(self, name: str) -> Any: ...  # incomplete

class XTick(Tick):
    def __getattr__(self, name: str) -> Any: ...  # incomplete

class YTick(Tick):
    def __getattr__(self, name: str) -> Any: ...  # incomplete

class SubplotBase:
    # TODO: write overloads for various forms
    def __init__(self, fig: Figure, *args: Any, **kwargs: Any) -> None: ...

    def __getattr__(self, name: str) -> Any: ...  # incomplete
