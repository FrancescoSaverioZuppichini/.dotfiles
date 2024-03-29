# DotFiles 🕵️‍♂️


# Ubuntu

```
git clone https://github.com/FrancescoSaverioZuppichini/.dotfiles.git

cd .dotfiles
chmod 755 ./ubuntu20_04_setup.sh
sudo ./ubuntu20_04_setup.sh
```

# Packages

```
sudo apt update
sudo apt upgrade
```

# NVIDIA Shit

First disable nouveau

```
sudo bash -c "echo blacklist nouveau > /etc/modprobe.d/blacklist-nvidia-nouveau.conf"
sudo bash -c "echo options nouveau modeset=0 >> /etc/modprobe.d/blacklist-nvidia-nouveau.conf"

sudo reboot
```

Get [Cuda 11](https://developer.nvidia.com/cuda-11.0-download-archive)


```
wget https://developer.download.nvidia.com/compute/cuda/11.7.0/local_installers/cuda_11.7.0_515.43.04_linux.run
sudo sh cuda_11.7.0_515.43.04_linux.run
```

You need to manually install a driver [`>=450.6`](https://www.nvidia.com/download/driverResults.aspx/162107/en-us)

You can find more drivers [here](https://www.nvidia.com/Download/Find.aspx)

Install latest version of [cudnn](https://developer.nvidia.com/rdp/cudnn-download)

```
wget https://developer.nvidia.com/compute/cudnn/secure/8.4.1/local_installers/11.6/cudnn-linux-x86_64-8.4.1.50_cuda11.6-archive.tar.xz
sudo sh cuda_11.7.0_515.43.04_linux.run
```

## [ohmyzsh](https://github.com/ohmyzsh/ohmyzsh)

```
sudo apt install zsh
# zsh as default shell
sudo sh -c "echo $(which zsh) >> /etc/shells" && chsh -s $(which zsh)
sh -c "$(wget -O- https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

#### Autosuggestions
[zsh-autosuggestions](https://github.com/zsh-users/zsh-autosuggestions/blob/master/INSTALL.md)

```
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
```
### Autocompletions
[zsh-completions](https://github.com/zsh-users/zsh-completions)
```
git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:=~/.oh-my-zsh/custom}/plugins/zsh-completions
```
#### Syntax Highlighting
[zsh-syntax-highlighting](https://github.com/zsh-users/zsh-syntax-highlighting/blob/master/INSTALL.md)

```
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

#### Auto jump
[autojump](https://github.com/wting/autojump)
```
sudo apt install autojump
```

## [NeoFetch](https://github.com/dylanaraps/neofetch)

```
sudo apt install neofetch
```
# Additional software
## Ubuntu 20.04
### [Albert](https://albertlauncher.github.io/installing/)

```
curl https://build.opensuse.org/projects/home:manuelschneid3r/public_key | sudo apt-key add -
echo 'deb http://download.opensuse.org/repositories/home:/manuelschneid3r/xUbuntu_20.04/ /' | sudo tee /etc/apt/sources.list.d/home:manuelschneid3r.list
sudo wget -nv https://download.opensuse.org/repositories/home:manuelschneid3r/xUbuntu_20.04/Release.key -O "/etc/apt/trusted.gpg.d/home:manuelschneid3r.asc"
sudo apt update
sudo apt install albert
```

[Cerebro](https://github.com/KELiON/cerebro) seems a nice alternative but they have to update their binaries

### [Plank](https://launchpad.net/plank)

```
sudo apt install plank

```

## [Hyper](https://hyper.is/)

```
wget -O /tmp/hyper_amd64.deb https://releases.hyper.is/download/deb
dpkg -i /tmp/hyper_amd64.deb
```

## [VSCode](https://linuxize.com/post/how-to-install-visual-studio-code-on-ubuntu-18-04/)

```
apt update
wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main"
sudo apt update
sudo apt install code
```

## 



[docker-compose](https://docs.docker.com/compose/install/)

```
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
 curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  
sudo apt-get update
apt-get install docker-ce docker-ce-cli containerd.io
# to verify run sudo docker run hello-world
usermod -aG docker $USER
# docker compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.28.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### [Nvidia Docker](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html#docker)


```
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list \
  && \
    sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
```

E.g. 

```
docker run --gpus all -v /home/zuppif/.../:/workspace --ipc=host --ulimit memlock=-1 --ulimit stack=67108864  -it --rm nvcr.io/nvidia/pytorch:22.06-py3
```

## Anaconda

```
wget -O /tmp/Anaconda3-2021.11-Linux-x86_64.sh https://repo.anaconda.com/archive/Anaconda3-2021.11-Linux-x86_64.sh
# sha256sum Anaconda3-2021.11-Linux-x86_64.sh 
chmod 755 /tmp/Anaconda3-2021.11-Linux-x86_64.sh
/tmp/Anaconda3-2020.11-Linux-x86_64.sh 
# create conda env for deep learning (run from current shell)
source ~/anaconda3/etc/profile.d/conda.sh
conda create -n dl python=3.8
conda activate dl
pip install -R requirements.txt
```

## Pillow simd

```
conda activate dl
pip uninstall pillow
CC="cc -mavx2" pip install -U --force-reinstall pillow-simd
```

## [Insomnia](https://insomnia.rest/)

```
# Add to sources
echo "deb https://dl.bintray.com/getinsomnia/Insomnia /" \
    | sudo tee -a /etc/apt/sources.list.d/insomnia.list

# Add public key used to verify code signature
wget --quiet -O - https://insomnia.rest/keys/debian-public.key.asc \
    | sudo apt-key add -

# Refresh repository sources and install Insomnia
sudo apt-get update
sudo apt-get install insomnia
```

## Node.js

Releases from [here](https://github.com/nodesource/distributions/blob/master/README.md#debinstall)

```
# Using Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## [Brave](https://brave.com/linux/)

```
sudo apt install apt-transport-https curl gnupg

curl -s https://brave-browser-apt-release.s3.brave.com/brave-core.asc | sudo apt-key --keyring /etc/apt/trusted.gpg.d/brave-browser-release.gpg add -

echo "deb [arch=amd64] https://brave-browser-apt-release.s3.brave.com/ stable main" | sudo tee /etc/apt/sources.list.d/brave-browser-release.list

sudo apt update

sudo apt install brave-browser
```

## [ImageMagick](https://blog.gregzaal.com/install-imagemagick/)

```
sudo apt-get install imagemagick -y
```

## Symbolic links

Different files are symbolically linked to my ~ 

[here](https://unix.stackexchange.com/questions/71253/what-should-shouldnt-go-in-zshenv-zshrc-zlogin-zprofile-zlogout) there is a nice explanation about each file in the `zsh` ecosystem.

## [Bat](https://github.com/sharkdp/bat

A cat(1) clone with wings.

```
sudo apt install bat -y

```

`bat` clash with another package, let's fix it

```
mkdir -p ~/.local/bin
ln -s /usr/bin/batcat ~/.local/bin/bat
```

## Python

### [Rich](https://github.com/willmcgugan/rich)

Supercharge your stacktrace

```
pip install rich
cd $(python -c 'import site; print(site.getsitepackages()[0])')
mkdir sitecustomize  
cd sitecustomize 
echo "from rich.traceback import install\install()" >> __init__.py
```


## Q&A
### Cannot set `sheel theme`
Open 

```
gnome-extensions-app
```

And you should be able to see `user themes` and you set it from here, otherwise restart gnome with `alt` + `f2` and type `r`